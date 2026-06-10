import type { AuthUser } from '@acc/types';

/** True when the user holds a scoped Captain or Vice-Captain assignment. */
export function hasTeamLeadAccess(user: AuthUser | null | undefined): boolean {
  return (user?.teamLeadAssignments?.length ?? 0) > 0;
}
