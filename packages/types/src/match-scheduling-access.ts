import { type AuthUser, UserRole } from './auth';
import { BallType, type BallType as BallTypeValue } from './rbac';
import { hasTeamLeadershipInTournament } from './team-access';

/** Admin / Club Manager — edit or delete upcoming match fixtures. */
export function canManageUpcomingMatchSchedule(
  user: AuthUser | null | undefined,
): boolean {
  if (!user) {
    return false;
  }
  return user.role === UserRole.Admin || user.role === UserRole.ClubManager;
}

/** Admin / Club Manager / Center Sevak — unrestricted tournament match scheduling. */
export function canScheduleTournamentMatchesAsOrganizer(
  user: AuthUser | null | undefined,
): boolean {
  if (!user) {
    return false;
  }
  if (user.role === UserRole.Admin || user.role === UserRole.ClubManager) {
    return true;
  }
  if (user.role === UserRole.CenterSevak) {
    return true;
  }
  return (user.centerSevakCenterIds?.length ?? 0) > 0;
}

/**
 * Optimistic UI gate for CREATE_MATCH (§11, §27): organizers everywhere; Captain /
 * Vice-Captain for Leather tournaments involving their team (server enforces scope).
 */
export function canScheduleTournamentMatches(
  user: AuthUser | null | undefined,
  options?: { ballType?: BallTypeValue | null; tournamentId?: string },
): boolean {
  if (canScheduleTournamentMatchesAsOrganizer(user)) {
    return true;
  }
  const ballType = options?.ballType;
  const tournamentId = options?.tournamentId;
  if (
    ballType === BallType.Leather &&
    tournamentId &&
    hasTeamLeadershipInTournament(user, tournamentId)
  ) {
    return true;
  }
  return false;
}

/** Captain-equivalent leadership team ids in one tournament. */
export function leaderTeamIdsInTournament(
  user: AuthUser | null | undefined,
  tournamentId: string,
): string[] {
  if (!user) {
    return [];
  }
  return (user.teamLeadAssignments ?? [])
    .filter(
      (assignment) =>
        assignment.tournamentId === tournamentId &&
        (assignment.role === UserRole.Captain || assignment.role === UserRole.ViceCaptain),
    )
    .map((assignment) => assignment.teamId);
}
