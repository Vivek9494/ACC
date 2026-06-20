import {
  type InningsScorecard,
  DeliveryType,
  InningsType,
  type ScorecardResponse,
} from '@acc/types';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { Delivery, Match } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { deriveInnings, deriveMatchResult } from './engine';
import { selectedParticipantContext } from './innings-participant-mapper';
import { toScoringEvent } from './delivery-mapper';
import {
  collectParticipantIds,
  ScorecardDisplayBuilder,
  type MatchContext,
} from './scorecard-display.builder';

/**
 * Builds the derived {@link ScorecardResponse} for a match by folding over the
 * append-only delivery log (spec §12, §28). Read-only and Prisma-coupled; the
 * scoring writer and the confirmation/PDF services all derive from this single
 * builder so totals/figures never diverge.
 */
@Injectable()
export class ScorecardReader {
  constructor(
    private readonly prisma: PrismaService,
    private readonly displayBuilder: ScorecardDisplayBuilder,
  ) {}

  /** Loads the match and builds its scorecard, or throws if it is missing. */
  async byMatchId(matchId: string): Promise<ScorecardResponse> {
    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (!match) {
      throw new NotFoundException({ message: 'Match not found', error: 'MATCH_NOT_FOUND' });
    }
    return this.build(match);
  }

  async build(match: Match): Promise<ScorecardResponse> {
    const [matchContext, innings] = await Promise.all([
      this.loadMatchContext(match.id),
      this.prisma.innings.findMany({
        where: { matchId: match.id },
        orderBy: { sequence: 'asc' },
        include: {
          deliveries: {
            where: { isVoided: false },
            orderBy: { sequence: 'asc' },
          },
        },
      }),
    ]);

    if (!matchContext) {
      throw new NotFoundException({ message: 'Match not found', error: 'MATCH_NOT_FOUND' });
    }

    const originalTarget = match.originalTarget ?? null;
    const dlsTarget = match.dlsTarget ?? null;
    const effectiveTarget = dlsTarget ?? originalTarget;

    const cards: InningsScorecard[] = innings.map((inn) => {
      const superOvers = innings.filter((row) => row.inningsType === InningsType.SuperOver);
      const superIndex =
        inn.inningsType === InningsType.SuperOver
          ? superOvers.findIndex((row) => row.id === inn.id)
          : -1;

      let target: number | null = inn.revisedTarget ?? null;
      if (inn.inningsType === InningsType.Normal && inn.sequence > 1) {
        const firstNormal = innings.find((row) => row.inningsType === InningsType.Normal);
        const firstRuns = firstNormal
          ? deriveInnings(this.eventsForInningsFold(firstNormal, innings), {
              battingTeamId: firstNormal.battingTeamId,
            }).runs
          : 0;
        target = effectiveTarget ?? firstRuns + 1;
      } else if (inn.inningsType === InningsType.SuperOver && superIndex > 0 && superIndex % 2 === 1) {
        const firstSo = superOvers[superIndex - 1];
        const firstRuns = firstSo
          ? deriveInnings(this.eventsForInningsFold(firstSo, innings), {
              battingTeamId: firstSo.battingTeamId,
            }).runs
          : 0;
        target = firstRuns + 1;
      }

      return deriveInnings(
        this.eventsForInningsFold(inn, innings),
        {
          inningsId: inn.id,
          sequence: inn.sequence,
          inningsType: inn.inningsType as InningsType,
          battingTeamId: inn.battingTeamId,
          bowlingTeamId: inn.bowlingTeamId,
          oversAllotted: inn.oversAllotted,
          target,
          ...selectedParticipantContext(inn),
        },
      );
    });

    const result = deriveMatchResult(cards);
    const core = {
      matchId: match.id,
      version: match.scorecardVersion,
      originalTarget,
      dlsTarget,
      effectiveTarget,
      innings: cards,
      result: { ...result, isNoResult: match.isNoResult || result.isNoResult },
    };

    const display = this.displayBuilder.build(matchContext, core, innings);
    const participantIds = collectParticipantIds({ ...core, display });
    display.players = await this.displayBuilder.enrichPlayers(
      match.id,
      display.players,
      participantIds,
    );

    return { ...core, display };
  }

  private async loadMatchContext(matchId: string): Promise<MatchContext | null> {
    return this.prisma.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        homeTeamId: true,
        awayTeamId: true,
        externalOpponentName: true,
        homeTeam: { select: { id: true, name: true, logoUrl: true } },
        awayTeam: { select: { id: true, name: true, logoUrl: true } },
        squads: {
          include: {
            team: { select: { id: true, name: true, logoUrl: true } },
            players: {
              include: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
        externalPlayers: { select: { id: true, name: true } },
      },
    });
  }

  private eventsForInningsFold(
    inn: { id: string; battingTeamId: string | null; deliveries: Delivery[] },
    allInnings: { id: string; battingTeamId: string | null; deliveries: Delivery[] }[],
  ) {
    const direct = inn.deliveries.map((d) => toScoringEvent(d));
    const cross: ReturnType<typeof toScoringEvent>[] = [];
    for (const other of allInnings) {
      if (other.id === inn.id) {
        continue;
      }
      for (const d of other.deliveries) {
        if (d.type !== DeliveryType.PenaltyRuns) {
          continue;
        }
        const beneficiary = d.penaltyBeneficiaryTeamId ?? other.battingTeamId;
        if (beneficiary && beneficiary === inn.battingTeamId) {
          cross.push(toScoringEvent(d));
        }
      }
    }
    return [...direct, ...cross].sort(
      (a, b) => a.eventSortMs - b.eventSortMs || a.sequence - b.sequence,
    );
  }
}
