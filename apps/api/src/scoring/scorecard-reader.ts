import {
  type InningsScorecard,
  InningsType,
  type ScorecardResponse,
} from '@acc/types';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { Delivery, Match } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { deriveInnings, deriveMatchResult } from './engine';
import { toScoringEvent } from './delivery-mapper';

/**
 * Builds the derived {@link ScorecardResponse} for a match by folding over the
 * append-only delivery log (spec §12, §28). Read-only and Prisma-coupled; the
 * scoring writer and the confirmation/PDF services all derive from this single
 * builder so totals/figures never diverge.
 */
@Injectable()
export class ScorecardReader {
  constructor(private readonly prisma: PrismaService) {}

  /** Loads the match and builds its scorecard, or throws if it is missing. */
  async byMatchId(matchId: string): Promise<ScorecardResponse> {
    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (!match) {
      throw new NotFoundException({ message: 'Match not found', error: 'MATCH_NOT_FOUND' });
    }
    return this.build(match);
  }

  async build(match: Match): Promise<ScorecardResponse> {
    const innings = await this.prisma.innings.findMany({
      where: { matchId: match.id },
      orderBy: { sequence: 'asc' },
      include: {
        deliveries: {
          where: { isVoided: false },
          orderBy: { sequence: 'asc' },
        },
      },
    });

    const originalTarget = match.originalTarget ?? null;
    const dlsTarget = match.dlsTarget ?? null;
    const effectiveTarget = dlsTarget ?? originalTarget;

    const cards: InningsScorecard[] = innings.map((inn, index) => {
      // The chasing innings is everything after the first; its target is the
      // first innings' runs + 1 unless overridden by a DLS/explicit target.
      const isChase = index > 0 && inn.inningsType === InningsType.Normal;
      const firstRuns = this.foldRuns(innings[0]?.deliveries ?? []);
      const target = isChase ? (effectiveTarget ?? firstRuns + 1) : (inn.revisedTarget ?? null);
      return deriveInnings(
        inn.deliveries.map((d) => toScoringEvent(d)),
        {
          inningsId: inn.id,
          sequence: inn.sequence,
          inningsType: inn.inningsType as InningsType,
          battingTeamId: inn.battingTeamId,
          bowlingTeamId: inn.bowlingTeamId,
          oversAllotted: inn.oversAllotted,
          target,
        },
      );
    });

    const result = deriveMatchResult(cards);
    return {
      matchId: match.id,
      version: match.scorecardVersion,
      originalTarget,
      dlsTarget,
      effectiveTarget,
      innings: cards,
      result: { ...result, isNoResult: match.isNoResult || result.isNoResult },
    };
  }

  private foldRuns(deliveries: Delivery[]): number {
    return deriveInnings(deliveries.map((d) => toScoringEvent(d))).runs;
  }
}
