import type { Prisma } from '@prisma/client';

/** Active roster membership. Soft-deleted rows remain only for audit/reactivation. */
export const activeTeamMembershipWhere = {
  isDeleted: false,
  deletedAt: null,
} as const satisfies Prisma.TeamMembershipWhereInput;

/** Filtered relation count used by team/group/tournament summaries. */
export const activeTeamMembershipCountSelect = {
  where: activeTeamMembershipWhere,
} as const satisfies Prisma.TeamCountOutputTypeCountMembershipsArgs;
