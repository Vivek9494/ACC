import { UserRole } from '@acc/types';
import type { PrismaClient } from '@prisma/client';

/** Prisma client or interactive transaction client. */
type DbClient = Pick<PrismaClient, 'roleAssignment' | 'user'>;

/**
 * Keep platform role CENTER_SEVAK and RoleAssignment(centerId) in sync.
 * Admin create/update must call this so Sevak-scoped APIs have a center.
 */
export async function syncCenterSevakRoleAssignment(
  db: DbClient,
  userId: string,
  platformRole: UserRole,
  centerId: string,
): Promise<void> {
  await db.roleAssignment.deleteMany({
    where: { userId, role: UserRole.CenterSevak },
  });

  if (platformRole !== UserRole.CenterSevak) {
    return;
  }

  await db.roleAssignment.create({
    data: {
      userId,
      role: UserRole.CenterSevak,
      centerId,
    },
  });
}

/**
 * Resolve Sevak center ids from RoleAssignment. If the user is platform
 * Center Sevak but has no assignment (legacy admin role change), heal from
 * User.centerId so Home / JWT claims work without a re-edit.
 */
export async function resolveOrHealCenterSevakCenterIds(
  db: DbClient,
  userId: string,
): Promise<string[]> {
  const rows = await db.roleAssignment.findMany({
    where: { userId, role: UserRole.CenterSevak, centerId: { not: null } },
    select: { centerId: true },
  });
  const fromAssignments = rows
    .map((row) => row.centerId)
    .filter((id): id is string => id !== null);
  if (fromAssignments.length > 0) {
    return fromAssignments;
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, centerId: true },
  });
  if (!user || user.role !== UserRole.CenterSevak || !user.centerId) {
    return [];
  }

  await syncCenterSevakRoleAssignment(db, userId, UserRole.CenterSevak, user.centerId);
  return [user.centerId];
}
