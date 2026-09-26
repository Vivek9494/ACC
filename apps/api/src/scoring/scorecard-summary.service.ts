import {
  InningsType,
  MatchSquadRole,
  MatchState,
  Permission,
  ScoringMode,
  ScorecardAuditAction,
  WICKETS_FOR_ALL_OUT,
  formatMatchResultNote,
  parseOversTextToLegalBalls,
  resolveMatchWinnerDisplayName,
  type AuthUser,
  type ScorecardSummaryValidationIssue,
  type UpsertScorecardSummaryRequest,
  type UpsertScorecardSummaryResponse,
} from '@acc/types';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  DismissalType as PrismaDismissalType,
  InningsType as PrismaInningsType,
  Prisma,
} from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { PermissionService } from '../authz/permission.service';
import { activeMatchFirstWhere } from '../matches/match-query';
import { PrismaService } from '../prisma/prisma.service';
import { deriveMatchResult } from './engine';
import {
  buildInningsScorecardFromSummary,
  mergeScorecardOnlyResult,
  type ScorecardSummaryInningsInput,
} from './scorecard-summary.builder';
import { ScorecardReader } from './scorecard-reader';

/** True when overs text is a valid cricket overs string (e.g. "21.2"). */
function isValidOversText(oversText: string): boolean {
  const trimmed = oversText.trim();
  if (trimmed.length === 0) {
    return false;
  }
  return /^(\d+)(?:\.([0-5]))?$/.test(trimmed);
}

/**
 * Admin SCORECARD_ONLY backfill writer — persists summary figures Phase 1
 * reads, then completes + admin-locks the match.
 */
@Injectable()
export class ScorecardSummaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionService,
    private readonly reader: ScorecardReader,
    private readonly audit: AuditService,
  ) {}

  async upsert(
    actor: AuthUser,
    matchId: string,
    dto: UpsertScorecardSummaryRequest,
  ): Promise<UpsertScorecardSummaryResponse> {
    const allowed = await this.permissions.check(Permission.BACKFILL_MATCH, actor, {
      matchId,
    });
    if (!allowed) {
      throw new ForbiddenException({
        message: 'Only an Admin can enter a scorecard-only backfill',
        error: 'FORBIDDEN',
      });
    }

    const match = await this.prisma.match.findFirst({
      where: activeMatchFirstWhere(matchId),
      include: {
        tournament: { select: { ballType: true, type: true } },
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
      },
    });
    if (!match) {
      throw new NotFoundException({ message: 'Match not found', error: 'MATCH_NOT_FOUND' });
    }
    if ((match.scoringMode as ScoringMode) !== ScoringMode.ScorecardOnly) {
      throw new BadRequestException({
        message: 'This match is not a scorecard-only backfill',
        error: 'NOT_SCORECARD_ONLY',
      });
    }
    if (match.state === MatchState.ScorecardLocked) {
      throw new BadRequestException({
        message: 'This scorecard is already locked',
        error: 'SCORECARD_LOCKED',
      });
    }

    const { hardErrors, warnings } = this.validate(dto);
    if (hardErrors.length > 0) {
      throw new BadRequestException({
        message: hardErrors[0]!.message,
        error: hardErrors[0]!.code,
        fields: Object.fromEntries(
          hardErrors.map((issue) => [
            issue.inningsSequence != null
              ? `innings.${issue.inningsSequence}`
              : issue.code,
            issue.message,
          ]),
        ),
      });
    }

    const now = new Date();
    const oversAllottedDefault = match.oversPerInnings;
    const isNoResult = dto.isNoResult === true;
    const winningTeamId = isNoResult ? null : (dto.winningTeamId ?? null);
    const resultNote = this.deriveResultNote(dto, match, winningTeamId, isNoResult);

    await this.prisma.$transaction(async (tx) => {
      await tx.scorecardFallOfWicket.deleteMany({
        where: { inningsSummary: { matchId } },
      });
      await tx.scorecardBatterSummary.deleteMany({
        where: { inningsSummary: { matchId } },
      });
      await tx.scorecardBowlerSummary.deleteMany({
        where: { inningsSummary: { matchId } },
      });
      await tx.scorecardInningsSummary.deleteMany({ where: { matchId } });

      for (const innings of [...dto.innings].sort((a, b) => a.sequence - b.sequence)) {
        const extrasByes = innings.extrasByes ?? 0;
        const extrasLegByes = innings.extrasLegByes ?? 0;
        const extrasWides = innings.extrasWides ?? 0;
        const extrasNoBalls = innings.extrasNoBalls ?? 0;
        const extrasPenalties = innings.extrasPenalties ?? 0;
        const extrasTotal =
          extrasByes + extrasLegByes + extrasWides + extrasNoBalls + extrasPenalties;
        const legalBalls = parseOversTextToLegalBalls(innings.oversText);

        await tx.scorecardInningsSummary.create({
          data: {
            matchId,
            sequence: innings.sequence,
            inningsType: (innings.inningsType ?? InningsType.Normal) as PrismaInningsType,
            battingTeamId: innings.battingTeamId,
            bowlingTeamId: innings.bowlingTeamId,
            battingIsExternal:
              innings.battingIsExternal ?? innings.battingTeamId == null,
            bowlingIsExternal:
              innings.bowlingIsExternal ?? innings.bowlingTeamId == null,
            runs: innings.runs,
            wickets: innings.wickets,
            legalBalls,
            oversText: innings.oversText.trim(),
            oversAllotted: innings.oversAllotted ?? oversAllottedDefault,
            closed: innings.closed ?? true,
            closeReason: innings.closeReason ?? null,
            target: innings.target ?? null,
            extrasByes,
            extrasLegByes,
            extrasWides,
            extrasNoBalls,
            extrasPenalties,
            extrasTotal,
            batters: {
              create: innings.batters.map((batter, index) => ({
                sortOrder: index,
                playerId: batter.playerId,
                runs: batter.runs,
                balls: batter.balls,
                fours: batter.fours ?? 0,
                sixes: batter.sixes ?? 0,
                isOut: batter.isOut,
                dismissalType: (batter.dismissalType ?? null) as PrismaDismissalType | null,
                bowlerId: batter.bowlerId ?? null,
                fielderId: batter.fielderId ?? null,
                fielder2Id: batter.fielder2Id ?? null,
                retiredHurt: batter.retiredHurt ?? false,
                isMankad: batter.isMankad ?? false,
              })),
            },
            bowlers: {
              create: innings.bowlers.map((bowler, index) => ({
                sortOrder: index,
                playerId: bowler.playerId,
                legalBalls: parseOversTextToLegalBalls(bowler.oversText),
                maidens: bowler.maidens ?? 0,
                runsConceded: bowler.runsConceded,
                wickets: bowler.wickets,
                wides: bowler.wides ?? 0,
                noBalls: bowler.noBalls ?? 0,
              })),
            },
            fallOfWickets: {
              create: (innings.fallOfWickets ?? []).map((fow) => ({
                wicketNumber: fow.wicketNumber,
                playerId: fow.playerId,
                teamRuns: fow.teamRuns,
                oversText: fow.oversText.trim(),
              })),
            },
          },
        });

        if (
          innings.battingTeamId &&
          innings.squadPlayerIds &&
          innings.squadPlayerIds.length > 0
        ) {
          await this.upsertSquadPlayers(
            tx,
            matchId,
            innings.battingTeamId,
            innings.squadPlayerIds,
            actor.id,
          );
        }
      }

      const isNoResult = dto.isNoResult === true;
      await tx.match.update({
        where: { id: matchId },
        data: {
          tossWinner: dto.tossWinner ?? match.tossWinner,
          tossDecision: dto.tossDecision ?? match.tossDecision,
          winningTeamId,
          isNoResult,
          resultNote,
          state: MatchState.ScorecardLocked,
          completedAt: match.completedAt ?? now,
          confirmedAt: now,
          confirmedByUserId: actor.id,
          autoConfirmed: false,
          adminConfirmed: true,
          adminConfirmedByUserId: actor.id,
          adminConfirmedAt: now,
          homeTeamConfirmed: true,
          awayTeamConfirmed: true,
          scorecardVersion: { increment: 1 },
        },
      });
    });

    await this.audit.record({
      action: ScorecardAuditAction.Confirmed,
      actorUserId: actor.id,
      targetEntityType: 'match',
      targetEntityId: matchId,
      after: {
        scoringMode: ScoringMode.ScorecardOnly,
        winningTeamId: dto.winningTeamId ?? null,
        isNoResult: dto.isNoResult === true,
        inningsCount: dto.innings.length,
        warnings: warnings.map((w) => w.code),
      },
    });

    const scorecard = await this.reader.byMatchId(matchId);
    return { scorecard, warnings };
  }

  private validate(dto: UpsertScorecardSummaryRequest): {
    hardErrors: ScorecardSummaryValidationIssue[];
    warnings: ScorecardSummaryValidationIssue[];
  } {
    const hardErrors: ScorecardSummaryValidationIssue[] = [];
    const warnings: ScorecardSummaryValidationIssue[] = [];

    for (const innings of dto.innings) {
      if (!isValidOversText(innings.oversText)) {
        hardErrors.push({
          code: 'INVALID_OVERS_TEXT',
          severity: 'hard',
          message: `Innings ${innings.sequence}: overs must look like 21.2 (balls 0–5)`,
          inningsSequence: innings.sequence,
        });
      }
      if (innings.wickets > WICKETS_FOR_ALL_OUT) {
        hardErrors.push({
          code: 'WICKETS_OVER_LIMIT',
          severity: 'hard',
          message: `Innings ${innings.sequence}: wickets cannot exceed ${WICKETS_FOR_ALL_OUT}`,
          inningsSequence: innings.sequence,
        });
      }
      for (const bowler of innings.bowlers) {
        if (!isValidOversText(bowler.oversText)) {
          hardErrors.push({
            code: 'INVALID_OVERS_TEXT',
            severity: 'hard',
            message: `Innings ${innings.sequence}: bowler overs "${bowler.oversText}" is invalid`,
            inningsSequence: innings.sequence,
          });
        }
      }
      for (const fow of innings.fallOfWickets ?? []) {
        if (!isValidOversText(fow.oversText)) {
          hardErrors.push({
            code: 'INVALID_OVERS_TEXT',
            severity: 'hard',
            message: `Innings ${innings.sequence}: FoW overs "${fow.oversText}" is invalid`,
            inningsSequence: innings.sequence,
          });
        }
      }

      const extrasTotal =
        (innings.extrasByes ?? 0) +
        (innings.extrasLegByes ?? 0) +
        (innings.extrasWides ?? 0) +
        (innings.extrasNoBalls ?? 0) +
        (innings.extrasPenalties ?? 0);
      const battingRuns = innings.batters.reduce((sum, b) => sum + b.runs, 0);
      const accounted = battingRuns + extrasTotal;
      if (accounted !== innings.runs) {
        warnings.push({
          code: 'RUNS_EXTRAS_MISMATCH',
          severity: 'soft',
          message: `Innings ${innings.sequence}: batting (${battingRuns}) + extras (${extrasTotal}) = ${accounted}, but total is ${innings.runs}`,
          inningsSequence: innings.sequence,
        });
      }
    }

    return { hardErrors, warnings };
  }

  /**
   * Derive the persisted result line from innings totals + Admin winner /
   * No Result (same wording as live completion).
   */
  private deriveResultNote(
    dto: UpsertScorecardSummaryRequest,
    match: {
      homeTeamId: string | null;
      awayTeamId: string | null;
      externalOpponentName: string | null;
      homeTeam: { id: string; name: string } | null;
      awayTeam: { id: string; name: string } | null;
    },
    winningTeamId: string | null,
    isNoResult: boolean,
  ): string | null {
    if (isNoResult) {
      return 'No Result';
    }

    const cards = [...dto.innings]
      .sort((a, b) => a.sequence - b.sequence)
      .map((innings, index) => {
        const extrasByes = innings.extrasByes ?? 0;
        const extrasLegByes = innings.extrasLegByes ?? 0;
        const extrasWides = innings.extrasWides ?? 0;
        const extrasNoBalls = innings.extrasNoBalls ?? 0;
        const extrasPenalties = innings.extrasPenalties ?? 0;
        const input: ScorecardSummaryInningsInput = {
          id: `pending-${index + 1}`,
          sequence: innings.sequence,
          inningsType: innings.inningsType ?? InningsType.Normal,
          battingTeamId: innings.battingTeamId,
          bowlingTeamId: innings.bowlingTeamId,
          battingIsExternal: innings.battingIsExternal ?? innings.battingTeamId == null,
          bowlingIsExternal: innings.bowlingIsExternal ?? innings.bowlingTeamId == null,
          runs: innings.runs,
          wickets: innings.wickets,
          legalBalls: parseOversTextToLegalBalls(innings.oversText),
          oversText: innings.oversText.trim(),
          oversAllotted: innings.oversAllotted ?? null,
          closed: innings.closed ?? true,
          closeReason: innings.closeReason ?? null,
          target: innings.target ?? null,
          extrasByes,
          extrasLegByes,
          extrasWides,
          extrasNoBalls,
          extrasPenalties,
          extrasTotal:
            extrasByes + extrasLegByes + extrasWides + extrasNoBalls + extrasPenalties,
          batters: innings.batters,
          bowlers: innings.bowlers.map((bowler) => ({
            playerId: bowler.playerId,
            legalBalls: parseOversTextToLegalBalls(bowler.oversText),
            maidens: bowler.maidens,
            runsConceded: bowler.runsConceded,
            wickets: bowler.wickets,
            wides: bowler.wides,
            noBalls: bowler.noBalls,
          })),
          fallOfWickets: innings.fallOfWickets,
        };
        return buildInningsScorecardFromSummary(input);
      });

    const derived = deriveMatchResult(cards);
    const result = mergeScorecardOnlyResult(derived, {
      winningTeamId,
      isNoResult: false,
      resultNote: null,
    });
    const winnerName = resolveMatchWinnerDisplayName(
      {
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        homeTeamName: match.homeTeam?.name ?? null,
        awayTeamName: match.awayTeam?.name ?? null,
        externalOpponentName: match.externalOpponentName,
      },
      result,
      cards,
    );
    return formatMatchResultNote(winnerName, result);
  }

  private async upsertSquadPlayers(
    tx: Prisma.TransactionClient,
    matchId: string,
    teamId: string,
    playerIds: string[],
    actorUserId: string,
  ): Promise<void> {
    const unique = [...new Set(playerIds.filter(Boolean))];
    if (unique.length === 0) {
      return;
    }
    let squad = await tx.matchSquad.findUnique({
      where: { matchId_teamId: { matchId, teamId } },
    });
    if (!squad) {
      squad = await tx.matchSquad.create({
        data: {
          matchId,
          teamId,
          lockedByUserId: actorUserId,
          lockedAt: new Date(),
          isFinalized: true,
          finalizedByUserId: actorUserId,
          finalizedAt: new Date(),
        },
      });
    }
    const existing = await tx.matchSquadPlayer.findMany({
      where: { squadId: squad.id },
      select: { userId: true },
    });
    const have = new Set(existing.map((p) => p.userId));
    const toAdd = unique.filter((id) => !have.has(id));
    if (toAdd.length === 0) {
      return;
    }
    await tx.matchSquadPlayer.createMany({
      data: toAdd.map((userId, index) => ({
        squadId: squad!.id,
        userId,
        role: MatchSquadRole.PlayingXi,
        battingOrder: have.size + index + 1,
      })),
      skipDuplicates: true,
    });
  }
}
