import type { Prisma, PrismaClient } from '@prisma/client';

import { activeMatchWhere } from '../matches/match-query';
import { activeTeamWhere } from '../teams/team-query';

type PrismaMatchReader = Pick<PrismaClient, 'match'>;

/** Live match assigned to this group with at least one participating team still in the group. */
export function groupBlockingMatchWhere(
  tournamentId: string,
  groupId: string,
): Prisma.MatchWhereInput {
  return {
    tournamentId,
    groupId,
    ...activeMatchWhere,
    OR: [
      { homeTeam: { groupId, ...activeTeamWhere } },
      { awayTeam: { groupId, ...activeTeamWhere } },
    ],
  };
}

/** Live match still tagged to this group but neither team remains in it (stale groupId). */
export function groupOrphanedMatchWhere(
  tournamentId: string,
  groupId: string,
): Prisma.MatchWhereInput {
  return {
    tournamentId,
    groupId,
    ...activeMatchWhere,
    NOT: {
      OR: [
        { homeTeam: { groupId, ...activeTeamWhere } },
        { awayTeam: { groupId, ...activeTeamWhere } },
      ],
    },
  };
}

/** Per-group counts of live matches that should block group deletion. */
export async function resolveGroupBlockingLiveMatchCounts(
  prisma: PrismaMatchReader,
  tournamentId: string,
  groupIds: readonly string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const groupId of groupIds) {
    counts.set(groupId, 0);
  }
  if (groupIds.length === 0) {
    return counts;
  }

  const matches = await prisma.match.findMany({
    where: {
      tournamentId,
      groupId: { in: [...groupIds] },
      ...activeMatchWhere,
    },
    select: {
      groupId: true,
      homeTeam: { select: { groupId: true } },
      awayTeam: { select: { groupId: true } },
    },
  });

  for (const match of matches) {
    if (!match.groupId) {
      continue;
    }
    const homeInGroup = match.homeTeam?.groupId === match.groupId;
    const awayInGroup = match.awayTeam?.groupId === match.groupId;
    if (homeInGroup || awayInGroup) {
      counts.set(match.groupId, (counts.get(match.groupId) ?? 0) + 1);
    }
  }

  return counts;
}

/** Live match (any state, group-stage or knockout) with a participating team currently in one of these groups. */
export function groupLockingMatchWhere(
  tournamentId: string,
  groupIds: readonly string[],
): Prisma.MatchWhereInput {
  const inGroups = { groupId: { in: [...groupIds] }, ...activeTeamWhere };
  return {
    tournamentId,
    ...activeMatchWhere,
    OR: [{ homeTeam: inGroups }, { awayTeam: inGroups }],
  };
}

/** Groups whose teams already have a match — rename, membership edits and delete are blocked. */
export async function resolveLockedGroupIds(
  prisma: PrismaMatchReader,
  tournamentId: string,
  groupIds: readonly string[],
): Promise<Set<string>> {
  const locked = new Set<string>();
  if (groupIds.length === 0) {
    return locked;
  }
  const matches = await prisma.match.findMany({
    where: groupLockingMatchWhere(tournamentId, groupIds),
    select: {
      homeTeam: { select: { groupId: true } },
      awayTeam: { select: { groupId: true } },
    },
  });
  const wanted = new Set(groupIds);
  for (const match of matches) {
    for (const groupId of [match.homeTeam?.groupId, match.awayTeam?.groupId]) {
      if (groupId && wanted.has(groupId)) {
        locked.add(groupId);
      }
    }
  }
  return locked;
}

export async function countGroupBlockingLiveMatches(
  prisma: PrismaMatchReader,
  tournamentId: string,
  groupId: string,
): Promise<number> {
  return prisma.match.count({
    where: groupBlockingMatchWhere(tournamentId, groupId),
  });
}

export async function unlinkGroupOrphanedLiveMatches(
  prisma: PrismaMatchReader,
  tournamentId: string,
  groupId: string,
): Promise<number> {
  const result = await prisma.match.updateMany({
    where: groupOrphanedMatchWhere(tournamentId, groupId),
    data: { groupId: null },
  });
  return result.count;
}
