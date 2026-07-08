import { MatchState } from '@acc/types';
import { MatchSquadRole, type Prisma, type PrismaClient } from '@prisma/client';

import { activeTournamentRelationWhere } from '../tournaments/tournament-query';

/**
 * Home dashboard featured-match queries: active rows only, never cancelled.
 */
export const dashboardFeaturedMatchBaseWhere: Prisma.MatchWhereInput = {
  isDeleted: false,
  state: { not: MatchState.Cancelled },
};

/** @deprecated Use {@link dashboardFeaturedMatchBaseWhere}. */
export const dashboardExcludeCancelledWhere = dashboardFeaturedMatchBaseWhere;

/** AND-combines a dashboard match query with the visibility base filter. */
export function withDashboardMatchVisibility(
  where: Prisma.MatchWhereInput,
): Prisma.MatchWhereInput {
  return {
    AND: [where, dashboardFeaturedMatchBaseWhere],
  };
}

/**
 * My Matches (Playing XI): non-cancelled fixtures always; cancelled only after
 * at least one delivery row exists (EXISTS subquery via Prisma `some`).
 */
export const myMatchesStateWhere: Prisma.MatchWhereInput = {
  OR: [
    { state: { not: MatchState.Cancelled } },
    {
      state: MatchState.Cancelled,
      innings: { some: { deliveries: { some: {} } } },
    },
  ],
};

/** Match ids where the user is in the posted Playing 11 (same source as My Matches). */
export async function findPlayingXiMatchIds(
  prisma: Pick<PrismaClient, 'matchSquadPlayer'>,
  userId: string,
): Promise<string[]> {
  const xiRows = await prisma.matchSquadPlayer.findMany({
    where: {
      userId,
      role: MatchSquadRole.PLAYING_XI,
      squad: {
        match: {
          isDeleted: false,
          ...activeTournamentRelationWhere,
        },
      },
    },
    select: { squad: { select: { matchId: true } } },
  });

  return [...new Set(xiRows.map((row) => row.squad.matchId))];
}

/**
 * Dashboard featured cards: fixtures for the user's teams OR where they are in the posted Playing 11.
 */
export function buildDashboardFeaturedMatchScopeWhere(
  teamIds: readonly string[],
  playingXiMatchIds: readonly string[],
): Prisma.MatchWhereInput {
  const scopeOr: Prisma.MatchWhereInput[] = [];

  if (playingXiMatchIds.length > 0) {
    scopeOr.push({ id: { in: [...playingXiMatchIds] } });
  }
  if (teamIds.length > 0) {
    scopeOr.push({
      OR: [{ homeTeamId: { in: [...teamIds] } }, { awayTeamId: { in: [...teamIds] } }],
    });
  }

  if (scopeOr.length === 0) {
    return { id: { in: [] } };
  }

  return { OR: scopeOr };
}
