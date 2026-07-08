import type { AuthUser, MatchDetail } from '@acc/types';
import { isCaptainOrViceCaptain, isPlayingXiOrganizer, isTeamLeaderRole } from '@acc/types';

/** True when the user holds a scoped Captain or Vice-Captain assignment. */
export function hasTeamLeadAccess(user: AuthUser | null | undefined): boolean {
  return (user?.teamLeadAssignments ?? []).some((assignment) =>
    isTeamLeaderRole(assignment.role),
  );
}

/** Admin/CM, or Captain/Vice-Captain of `teamId` in `tournamentId` — may confirm that team's Playing 11. */
export function canLockPlayingXiForTeam(
  user: AuthUser | null | undefined,
  tournamentId: string,
  teamId: string,
): boolean {
  if (!user) {
    return false;
  }
  if (isPlayingXiOrganizer(user)) {
    return true;
  }
  return isCaptainOrViceCaptain(user, tournamentId, teamId);
}

/** Assigned scorer, Admin, or Club Manager — may verify/edit Playing 11 for any team pre-match. */
export function canVerifyPlayingXiForMatch(
  user: AuthUser | null | undefined,
  match: Pick<MatchDetail, 'activeScorers'>,
): boolean {
  if (!user) {
    return false;
  }
  if (isPlayingXiOrganizer(user)) {
    return true;
  }
  return match.activeScorers.some((grant) => grant.userId === user.id);
}

export { isCaptainOrViceCaptain, hasTeamLeadershipInTournament } from '@acc/types';
