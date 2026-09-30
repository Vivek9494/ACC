import {
  isKnockoutMatchPlayedForDeleteWarning,
  KNOCKOUT_BRACKET_MESSAGES,
  KNOCKOUT_TOUCHED_MATCH_STATES,
  knockoutMatchRequiresResolution,
  MATCH_END_STATES,
  MatchState,
  QualificationReadinessStatus,
  supportsKnockoutStage,
  type AuthUser,
  type KnockoutBracketDeletePreview,
  type KnockoutBracketView,
  type TournamentType,
} from '@acc/types';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { groupStageMatchesForTournament } from '../knockout-qualification/group-stage-match-query';
import { KnockoutSeedingService } from '../knockout-seeding/knockout-seeding.service';
import { PrismaService } from '../prisma/prisma.service';
import { assertTournamentActive } from '../tournaments/tournament-query';
import { assertCanManageKnockoutBracket } from './knockout-bracket-auth.util';
import { buildKnockoutBracketPlan } from './knockout-bracket.generate';
import { enrichKnockoutBracketMatches } from './knockout-bracket-display';
import {
  ACTIVE_KNOCKOUT_MATCH_WHERE,
  activeKnockoutMatchesForBracket,
  activeKnockoutMatchesForTournament,
} from './knockout-match-query';

@Injectable()
export class KnockoutBracketService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly seeding: KnockoutSeedingService,
  ) {}

  async generateKnockoutBracket(
    actor: AuthUser,
    tournamentId: string,
    manualTeamIds?: readonly string[],
  ): Promise<KnockoutBracketView> {
    assertCanManageKnockoutBracket(actor);
    await this.assertNoActiveKnockoutBracket(tournamentId);

    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        isDeleted: true,
        type: true,
        knockoutTeamCount: true,
        _count: { select: { groups: true } },
      },
    });
    assertTournamentActive(tournament);

    if (!supportsKnockoutStage(tournament.type as TournamentType)) {
      throw new BadRequestException({
        message: KNOCKOUT_BRACKET_MESSAGES.notSupported,
        error: 'KNOCKOUT_BRACKET_NOT_SUPPORTED',
      });
    }

    if (tournament._count.groups === 0) {
      throw new BadRequestException({
        message: KNOCKOUT_BRACKET_MESSAGES.noGroups,
        error: 'KNOCKOUT_BRACKET_NO_GROUPS',
      });
    }

    if (tournament.knockoutTeamCount == null) {
      throw new BadRequestException({
        message: KNOCKOUT_BRACKET_MESSAGES.notConfigured,
        error: 'KNOCKOUT_BRACKET_NOT_CONFIGURED',
      });
    }

    const groupMatches = await this.countGroupStageMatches(tournamentId);
    if (groupMatches.total === 0 || groupMatches.incomplete > 0) {
      throw new BadRequestException({
        message: KNOCKOUT_BRACKET_MESSAGES.qualificationNotReady,
        error: 'KNOCKOUT_QUALIFICATION_NOT_READY',
        incompleteGroupMatchCount: groupMatches.incomplete,
        scheduledGroupMatchCount: groupMatches.total,
      });
    }

    const seedingResponse = await this.seeding.computeForGeneration(
      tournamentId,
      manualTeamIds,
    );
    if (seedingResponse.status === QualificationReadinessStatus.NotApplicable) {
      throw new BadRequestException({
        message: KNOCKOUT_BRACKET_MESSAGES.notSupported,
        error: 'KNOCKOUT_BRACKET_NOT_SUPPORTED',
      });
    }
    if (seedingResponse.status === QualificationReadinessStatus.NotConfigured) {
      throw new BadRequestException({
        message: KNOCKOUT_BRACKET_MESSAGES.notConfigured,
        error: 'KNOCKOUT_BRACKET_NOT_CONFIGURED',
      });
    }
    if (seedingResponse.status === QualificationReadinessStatus.NotReady) {
      throw new BadRequestException({
        message: KNOCKOUT_BRACKET_MESSAGES.qualificationNotReady,
        error: 'KNOCKOUT_QUALIFICATION_NOT_READY',
        incompleteGroupMatchCount: seedingResponse.incompleteGroupMatchCount,
        scheduledGroupMatchCount: seedingResponse.scheduledGroupMatchCount,
      });
    }

    const plan = buildKnockoutBracketPlan(seedingResponse.seeding);
    const { seeding } = seedingResponse;

    const bracketId = await this.prisma.$transaction(async (tx) => {
      const bracket = await tx.knockoutBracket.create({
        data: {
          tournamentId,
          bracketSize: seeding.bracketSize,
          byeCount: seeding.byeCount,
          knockoutTeamCount: seeding.knockoutTeamCount,
        },
      });

      const idByKey = new Map<string, string>();

      for (const entry of plan) {
        const created = await tx.match.create({
          data: {
            tournamentId,
            bracketId: bracket.id,
            state: MatchState.Scheduled,
            matchType: entry.matchType,
            homeTeamId: entry.homeTeamId,
            awayTeamId: entry.awayTeamId,
            awaitingTeams: entry.awaitingTeams,
            bracketRoundIndex: entry.bracketRoundIndex,
            bracketPosition: entry.bracketPosition,
            bracketRoundLabel: entry.bracketRoundLabel,
            groupId: null,
          },
        });
        idByKey.set(`${entry.bracketRoundIndex}:${entry.bracketPosition}`, created.id);
      }

      for (const entry of plan) {
        if (!entry.nextMatchKey || !entry.nextMatchSlot) {
          continue;
        }
        const matchId = idByKey.get(`${entry.bracketRoundIndex}:${entry.bracketPosition}`);
        const nextMatchId = idByKey.get(entry.nextMatchKey);
        if (!matchId || !nextMatchId) {
          throw new Error(
            `Missing match id for linkage ${entry.bracketRoundIndex}:${entry.bracketPosition} -> ${entry.nextMatchKey}`,
          );
        }
        await tx.match.update({
          where: { id: matchId },
          data: {
            nextMatchId,
            nextMatchSlot: entry.nextMatchSlot,
          },
        });
      }

      return bracket.id;
    });

    await this.audit.record({
      action: 'KNOCKOUT_BRACKET_GENERATED',
      actorUserId: actor.id,
      targetEntityType: 'tournament',
      targetEntityId: tournamentId,
      after: {
        bracketId,
        matchCount: plan.length,
        bracketSize: seeding.bracketSize,
        byeCount: seeding.byeCount,
        knockoutTeamCount: seeding.knockoutTeamCount,
      },
    });

    return this.getBracket(tournamentId);
  }

  /** Mirrors the generate prerequisites — drives `TournamentDetail.canGenerateKnockout`. */
  async canGenerateKnockout(
    tournamentId: string,
    tournament: { type: TournamentType; groupCount: number; knockoutTeamCount: number | null },
    hasKnockoutBracket: boolean,
  ): Promise<boolean> {
    if (
      hasKnockoutBracket ||
      !supportsKnockoutStage(tournament.type) ||
      tournament.groupCount === 0 ||
      tournament.knockoutTeamCount == null
    ) {
      return false;
    }
    const groupMatches = await this.countGroupStageMatches(tournamentId);
    return groupMatches.total > 0 && groupMatches.incomplete === 0;
  }

  private async countGroupStageMatches(
    tournamentId: string,
  ): Promise<{ total: number; incomplete: number }> {
    const where = groupStageMatchesForTournament(tournamentId);
    const [total, incomplete] = await Promise.all([
      this.prisma.match.count({ where }),
      this.prisma.match.count({
        where: { ...where, state: { notIn: [...MATCH_END_STATES] } },
      }),
    ]);
    return { total, incomplete };
  }

  /** Live KnockoutBracket row exists — not inferred from soft-deleted matches. */
  async hasKnockoutBracket(tournamentId: string): Promise<boolean> {
    const row = await this.prisma.knockoutBracket.findUnique({
      where: { tournamentId },
      select: { id: true },
    });
    return row != null;
  }

  async getDeletePreview(tournamentId: string): Promise<KnockoutBracketDeletePreview> {
    const bracket = await this.requireBracket(tournamentId);
    const matches = await this.prisma.match.findMany({
      where: activeKnockoutMatchesForBracket(bracket.id),
      select: {
        confirmedAt: true,
        _count: { select: { innings: true } },
      },
    });

    const playedKnockoutMatchCount = matches.filter((row) =>
      isKnockoutMatchPlayedForDeleteWarning({
        confirmedAt: row.confirmedAt,
        inningsCount: row._count.innings,
      }),
    ).length;

    return {
      totalKnockoutMatches: matches.length,
      playedKnockoutMatchCount,
    };
  }

  async getBracket(tournamentId: string): Promise<KnockoutBracketView> {
    const bracket = await this.requireBracket(tournamentId);
    const [tournament, matches] = await Promise.all([
      this.prisma.tournament.findUnique({
        where: { id: tournamentId },
        select: { championTeamId: true },
      }),
      this.prisma.match.findMany({
        where: activeKnockoutMatchesForBracket(bracket.id),
        orderBy: [{ bracketRoundIndex: 'desc' }, { bracketPosition: 'asc' }],
        select: {
          id: true,
          bracketRoundIndex: true,
          bracketPosition: true,
          bracketRoundLabel: true,
          homeTeamId: true,
          awayTeamId: true,
          nextMatchId: true,
          nextMatchSlot: true,
          state: true,
          confirmedAt: true,
          winningTeamId: true,
          isNoResult: true,
          awaitingTeams: true,
          homeTeam: { select: { name: true, logoUrl: true } },
          awayTeam: { select: { name: true, logoUrl: true } },
        },
      }),
    ]);

    const displayRows = matches.map((row) => ({
      id: row.id,
      bracketRoundIndex: row.bracketRoundIndex,
      bracketPosition: row.bracketPosition,
      bracketRoundLabel: row.bracketRoundLabel,
      homeTeamId: row.homeTeamId,
      awayTeamId: row.awayTeamId,
      nextMatchId: row.nextMatchId,
      nextMatchSlot: row.nextMatchSlot,
      state: row.state,
      confirmedAt: row.confirmedAt?.toISOString() ?? null,
      winningTeamId: row.winningTeamId,
      isNoResult: row.isNoResult,
      awaitingTeams: row.awaitingTeams,
      requiresResolution: knockoutMatchRequiresResolution(row),
      homeTeam: row.homeTeam,
      awayTeam: row.awayTeam,
    }));

    return {
      tournamentId,
      bracketSize: bracket.bracketSize,
      byeCount: bracket.byeCount,
      knockoutTeamCount: bracket.knockoutTeamCount,
      championTeamId: tournament?.championTeamId ?? null,
      matches: enrichKnockoutBracketMatches(displayRows),
    };
  }

  async deleteKnockoutBracket(actor: AuthUser, tournamentId: string): Promise<void> {
    assertCanManageKnockoutBracket(actor);

    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    assertTournamentActive(tournament);

    const bracket = await this.prisma.knockoutBracket.findUnique({
      where: { tournamentId },
    });
    if (!bracket) {
      throw new NotFoundException({
        message: KNOCKOUT_BRACKET_MESSAGES.notFound,
        error: 'KNOCKOUT_BRACKET_NOT_FOUND',
      });
    }

    const knockoutMatchIds = (
      await this.prisma.match.findMany({
        where: activeKnockoutMatchesForBracket(bracket.id),
        select: { id: true },
      })
    ).map((row) => row.id);

    const deletedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      if (knockoutMatchIds.length > 0) {
        await tx.match.updateMany({
          where: { id: { in: knockoutMatchIds } },
          data: {
            nextMatchId: null,
            nextMatchSlot: null,
          },
        });

        await tx.match.updateMany({
          where: { id: { in: knockoutMatchIds } },
          data: {
            isDeleted: true,
            deletedAt,
            deletedById: actor.id,
            bracketId: null,
            awaitingTeams: false,
            bracketRoundIndex: null,
            bracketPosition: null,
            bracketRoundLabel: null,
          },
        });
      }

      await tx.knockoutBracket.delete({ where: { id: bracket.id } });

      await tx.tournament.update({
        where: { id: tournamentId },
        data: { championTeamId: null },
      });
    });

    await this.audit.record({
      action: 'KNOCKOUT_BRACKET_DELETED',
      actorUserId: actor.id,
      targetEntityType: 'tournament',
      targetEntityId: tournamentId,
      after: {
        deletedMatchCount: knockoutMatchIds.length,
        bracketId: bracket.id,
      },
    });
  }

  /**
   * Count active knockout matches for a tournament — used by generation to
   * ensure soft-deleted ghost rows are excluded.
   */
  async countActiveKnockoutMatches(tournamentId: string): Promise<number> {
    return this.prisma.match.count({
      where: activeKnockoutMatchesForTournament(tournamentId),
    });
  }

  /** Secondary played/touched signal for CORRECT guard and delete diagnostics. */
  isKnockoutMatchTouched(state: string): boolean {
    return (KNOCKOUT_TOUCHED_MATCH_STATES as readonly string[]).includes(state);
  }

  private async requireBracket(tournamentId: string) {
    const bracket = await this.prisma.knockoutBracket.findUnique({
      where: { tournamentId },
    });
    if (!bracket) {
      throw new NotFoundException({
        message: KNOCKOUT_BRACKET_MESSAGES.notFound,
        error: 'KNOCKOUT_BRACKET_NOT_FOUND',
      });
    }
    return bracket;
  }

  async assertNoActiveKnockoutBracket(tournamentId: string): Promise<void> {
    if (await this.hasKnockoutBracket(tournamentId)) {
      throw new BadRequestException({
        message: KNOCKOUT_BRACKET_MESSAGES.alreadyExists,
        error: 'KNOCKOUT_BRACKET_ALREADY_EXISTS',
      });
    }
  }
}
