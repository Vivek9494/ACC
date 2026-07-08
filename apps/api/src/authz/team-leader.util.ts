import { UserRole } from '@acc/types';
import type { PrismaService } from '../prisma/prisma.service';

const TEAM_LEADER_ROLES = [UserRole.Captain, UserRole.ViceCaptain] as const;

const FAVOURITES_LEAD_ROLES = [
  UserRole.Captain,
  UserRole.ViceCaptain,
  UserRole.Manager,
] as const;

/** Prisma check: user is Captain or Vice-Captain of the team in the tournament. */
export async function isCaptainOrViceCaptain(
  prisma: PrismaService,
  userId: string,
  tournamentId: string,
  teamId: string,
): Promise<boolean> {
  const assignment = await prisma.roleAssignment.findFirst({
    where: {
      userId,
      teamId,
      tournamentId,
      role: { in: [...TEAM_LEADER_ROLES] },
    },
    select: { id: true },
  });
  return assignment != null;
}

/**
 * Resolves the viewer's team for the per-team favourites shortlist (Captain / VC / Manager).
 * Uses `RoleAssignment` rows — same source as permission checks, not JWT `teamLeadAssignments`.
 */
export async function favouritesLeadTeamIdInTournament(
  prisma: PrismaService,
  userId: string,
  tournamentId: string,
): Promise<string | null> {
  const row = await prisma.roleAssignment.findFirst({
    where: {
      userId,
      tournamentId,
      role: { in: [...FAVOURITES_LEAD_ROLES] },
    },
    select: { teamId: true },
    orderBy: [{ role: 'asc' }, { teamId: 'asc' }],
  });
  return row?.teamId ?? null;
}
