import { BallType, type AuthUser, Permission, UserRole } from '@acc/types';
import { ForbiddenException } from '@nestjs/common';

import type { PermissionService } from '../authz/permission.service';
import type { PrismaService } from '../prisma/prisma.service';

const TEAM_LEADER_ROLES = [UserRole.Captain, UserRole.ViceCaptain] as const;

async function leaderTeamIdsInTournament(
  prisma: PrismaService,
  userId: string,
  tournamentId: string,
): Promise<Set<string>> {
  const rows = await prisma.roleAssignment.findMany({
    where: {
      userId,
      tournamentId,
      role: { in: [...TEAM_LEADER_ROLES] },
    },
    select: { teamId: true },
  });
  return new Set(
    rows
      .map((row) => row.teamId)
      .filter((teamId): teamId is string => teamId != null),
  );
}

async function firstLeaderTeamId(
  prisma: PrismaService,
  userId: string,
  tournamentId: string,
): Promise<string | null> {
  const row = await prisma.roleAssignment.findFirst({
    where: {
      userId,
      tournamentId,
      role: { in: [...TEAM_LEADER_ROLES] },
    },
    select: { teamId: true },
    orderBy: [{ role: 'asc' }, { teamId: 'asc' }],
  });
  return row?.teamId ?? null;
}

/** Captain / VC team ids in one tournament (from role assignments, not login role). */
export async function viewerLeaderTeamIdsInTournament(
  prisma: PrismaService,
  userId: string,
  tournamentId: string,
  activeTeamIds?: ReadonlySet<string>,
): Promise<string[]> {
  const rows = await prisma.roleAssignment.findMany({
    where: {
      userId,
      tournamentId,
      role: { in: [...TEAM_LEADER_ROLES] },
    },
    select: { teamId: true },
    orderBy: [{ role: 'asc' }, { teamId: 'asc' }],
  });
  const ids = rows
    .map((row) => row.teamId)
    .filter((teamId): teamId is string => teamId != null);
  const unique = [...new Set(ids)];
  if (!activeTeamIds) {
    return unique;
  }
  return unique.filter((teamId) => activeTeamIds.has(teamId));
}

/** Non-throwing gate — true when actor may open the schedule flow for this tournament. */
export async function canActorScheduleTournamentMatches(
  permissions: PermissionService,
  prisma: PrismaService,
  actor: AuthUser,
  tournament: { id: string; ballType: BallType },
): Promise<boolean> {
  if (await permissions.check(Permission.CREATE_MATCH, actor, { tournamentId: tournament.id })) {
    return true;
  }
  if (tournament.ballType !== BallType.Leather) {
    return false;
  }
  const leaderTeamId = await firstLeaderTeamId(prisma, actor.id, tournament.id);
  if (!leaderTeamId) {
    return false;
  }
  return permissions.check(Permission.CREATE_MATCH, actor, {
    tournamentId: tournament.id,
    teamId: leaderTeamId,
  });
}

/** Tournament-level gate — opening the schedule flow or selecting a format. */
export async function assertCanScheduleTournamentMatches(
  permissions: PermissionService,
  prisma: PrismaService,
  actor: AuthUser,
  tournament: { id: string; ballType: BallType },
): Promise<void> {
  const allowed = await canActorScheduleTournamentMatches(
    permissions,
    prisma,
    actor,
    tournament,
  );
  if (!allowed) {
    throw new ForbiddenException({
      message: 'You do not have permission to schedule matches',
      error: 'FORBIDDEN',
    });
  }
}

/** Create-match gate — organizers unrestricted; captains only for own-team Leather fixtures. */
export async function assertCanCreateMatchFixture(
  permissions: PermissionService,
  prisma: PrismaService,
  actor: AuthUser,
  tournament: { id: string; ballType: BallType },
  homeTeamId: string,
): Promise<void> {
  if (await permissions.check(Permission.CREATE_MATCH, actor, { tournamentId: tournament.id })) {
    return;
  }

  if (tournament.ballType !== BallType.Leather) {
    throw new ForbiddenException({
      message: 'You do not have permission to create matches',
      error: 'FORBIDDEN',
    });
  }

  const leaderTeamIds = await leaderTeamIdsInTournament(prisma, actor.id, tournament.id);
  if (leaderTeamIds.size === 0) {
    throw new ForbiddenException({
      message: 'You do not have permission to create matches',
      error: 'FORBIDDEN',
    });
  }

  // Captains / VCs schedule only for their team — Team A (home) must be a team they lead.
  if (!leaderTeamIds.has(homeTeamId)) {
    throw new ForbiddenException({
      message: 'Captains can only create matches with their own team as Team A',
      error: 'FORBIDDEN',
    });
  }

  const allowed = await permissions.check(Permission.CREATE_MATCH, actor, {
    tournamentId: tournament.id,
    teamId: homeTeamId,
  });
  if (!allowed) {
    throw new ForbiddenException({
      message: 'You do not have permission to create matches',
      error: 'FORBIDDEN',
    });
  }
}
