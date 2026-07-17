import { type AuthUser, type TeamLeadAssignment, UserRole } from './auth';

/** Captain, Vice-Captain, or Manager — per-team roles that share the favourites shortlist. */
export function isTeamFavouritesLeadRole(role: UserRole): boolean {
  return (
    role === UserRole.Captain ||
    role === UserRole.ViceCaptain ||
    role === UserRole.Manager
  );
}

/**
 * True when the user holds Captain, Vice-Captain, or Manager for a team in the tournament.
 * Pass `teamId` to require a specific team.
 */
export function hasTeamFavouritesLeadInTournament(
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
      isTeamFavouritesLeadRole(assignment.role) &&
      (teamId === undefined || assignment.teamId === teamId),
  );
}

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

/**
 * True when the viewer may receive teammates' mobile numbers on a team roster.
 * Admin / Club Manager: all teams. Everyone else: only when they are a member of that team
 * (`isMemberOfTeam` from TeamMembership — server must resolve this; never trust the client alone).
 */
export function canViewTeamRosterMobileNumbers(
  user: AuthUser | null | undefined,
  isMemberOfTeam: boolean,
): boolean {
  if (!user) {
    return false;
  }
  if (user.role === UserRole.Admin || user.role === UserRole.ClubManager) {
    return true;
  }
  return isMemberOfTeam;
}

/** Admin or Club Manager may designate Captain, Vice-Captain, and Manager on teams they manage. */
export function canAssignTeamRoles(user: AuthUser | null | undefined): boolean {
  if (!user) {
    return false;
  }
  return user.role === UserRole.Admin || user.role === UserRole.ClubManager;
}

/** Admin or Club Manager — organizer override for Playing 11 verify/confirm (§9.7, §11). */
export function isPlayingXiOrganizer(user: AuthUser | null | undefined): boolean {
  return canAssignTeamRoles(user);
}

/**
 * Captain/VC of home or away in this match (§13.1 client gate — same `RoleAssignment` rows as
 * Playing 11 own-team checks). Excludes Club Manager fallback; use API eligibility for that.
 */
export function isMatchTeamCaptainOrViceCaptain(
  user: AuthUser | null | undefined,
  match: { tournamentId: string; homeTeamId: string | null; awayTeamId: string | null },
): boolean {
  if (!user) {
    return false;
  }
  const teamIds = [match.homeTeamId, match.awayTeamId].filter((id): id is string => Boolean(id));
  return teamIds.some((teamId) => isCaptainOrViceCaptain(user, match.tournamentId, teamId));
}

/**
 * Captain/VC of either team in the match, or Club Manager — see all dropped catches on the live scoring screen.
 */
export function canViewLiveScoringDroppedCatchCard(
  user: AuthUser | null | undefined,
  match: { tournamentId: string; homeTeamId: string | null; awayTeamId: string | null },
): boolean {
  if (!user) {
    return false;
  }
  if (user.role === UserRole.ClubManager) {
    return true;
  }
  return isMatchTeamCaptainOrViceCaptain(user, match);
}
