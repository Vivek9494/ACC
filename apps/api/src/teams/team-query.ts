import type { PrismaClient } from '@prisma/client';

import { activeMatchWhere } from '../matches/match-query';

/** Active (non-archived) teams — use on list/detail/count queries. */
export const activeTeamWhere = { deletedAt: null } as const;

/** Prisma `_count` select — excludes soft-deleted teams. */
export const activeTeamCountSelect = {
  teams: { where: activeTeamWhere },
} as const;

type PrismaMatchReader = Pick<PrismaClient, 'match'>;

/** Maps team ids to whether they appear in any active tournament match. */
export async function resolveTeamHasMatches(
  prisma: PrismaMatchReader,
  tournamentId: string,
  teamIds: string[],
): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>();
  for (const id of teamIds) {
    result.set(id, false);
  }
  if (teamIds.length === 0) {
    return result;
  }

  const matches = await prisma.match.findMany({
    where: {
      tournamentId,
      ...activeMatchWhere,
      OR: [{ homeTeamId: { in: teamIds } }, { awayTeamId: { in: teamIds } }],
    },
    select: { homeTeamId: true, awayTeamId: true },
  });

  for (const match of matches) {
    if (match.homeTeamId) {
      result.set(match.homeTeamId, true);
    }
    if (match.awayTeamId) {
      result.set(match.awayTeamId, true);
    }
  }

  return result;
}
