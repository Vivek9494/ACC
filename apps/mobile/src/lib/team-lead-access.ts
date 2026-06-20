import type { AuthUser } from '@acc/types';
import { isTeamLeaderRole } from '@acc/types';

/** True when the user holds a scoped Captain or Vice-Captain assignment. */
export function hasTeamLeadAccess(user: AuthUser | null | undefined): boolean {
  return (user?.teamLeadAssignments ?? []).some((assignment) =>
    isTeamLeaderRole(assignment.role),
  );
}

export { isCaptainOrViceCaptain, hasTeamLeadershipInTournament } from '@acc/types';
