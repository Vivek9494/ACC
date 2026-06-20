import { type AuthUser, type TeamLeadAssignment, UserRole } from './auth';

/** Captain or Vice-Captain — the per-team leadership roles that share RBAC. */
export function isTeamLeaderRole(role: UserRole): boolean {
  return role === UserRole.Captain || role === UserRole.ViceCaptain;
}

/**
 * True when the user holds Captain or Vice-Captain for a team in the tournament.
 * Pass `teamId` to require a specific team; omit it for any leadership in the tournament.
 */
export function isCaptainOrViceCaptain(
  user: AuthUser | null | undefined,
  tournamentId: string,
  teamId?: string,
): boolean {
  return hasTeamLeadershipInTournament(user, tournamentId, teamId);
}

/** Alias — same predicate as {@link isCaptainOrViceCaptain}. */
export function hasTeamLeadershipInTournament(
  user: AuthUser | null | undefined,
  tournamentId: string,
  teamId?: string,
): boolean {
  if (!user) {
    return false;
  }
  return (user.teamLeadAssignments ?? []).some(
    (assignment: TeamLeadAssignment) =>
      assignment.tournamentId === tournamentId &&
      isTeamLeaderRole(assignment.role) &&
      (teamId === undefined || assignment.teamId === teamId),
  );
}

/**
 * True when the user may open tournament player profiles (Team Detail → View Profile).
 * Captains and Vice-Captains (any team in the tournament) and Club Managers — cross-team.
 */
export function canViewTournamentPlayerProfiles(
  user: AuthUser | null | undefined,
  tournamentId: string,
): boolean {
  if (!user) {
    return false;
  }
  if (user.role === UserRole.Admin || user.role === UserRole.ClubManager) {
    return true;
  }
  return hasTeamLeadershipInTournament(user, tournamentId);
}

/** Club Manager may designate Captain and Vice-Captain on teams they organize. */
export function canAssignTeamRoles(user: AuthUser | null | undefined): boolean {
  return user?.role === UserRole.ClubManager;
}
