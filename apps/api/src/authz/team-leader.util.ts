import { UserRole } from '@acc/types';
import type { PrismaService } from '../prisma/prisma.service';

const TEAM_LEADER_ROLES = [UserRole.Captain, UserRole.ViceCaptain] as const;

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
