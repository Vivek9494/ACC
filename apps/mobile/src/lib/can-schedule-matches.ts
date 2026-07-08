import {
  canManageUpcomingMatchSchedule as canManageUpcomingMatchScheduleFromTypes,
  canScheduleTournamentMatches as canScheduleTournamentMatchesFromTypes,
  canScheduleTournamentMatchesAsOrganizer as canScheduleTournamentMatchesAsOrganizerFromTypes,
  leaderTeamIdsInTournament,
  type AuthUser,
  type BallTypeValue,
} from '@acc/types';

export { leaderTeamIdsInTournament };

/** Admin / Club Manager — edit or delete upcoming match fixtures. */
export function canManageUpcomingMatchSchedule(
  user: AuthUser | null | undefined,
): boolean {
  return canManageUpcomingMatchScheduleFromTypes(user);
}

/**
 * Optimistic UI gate for CREATE_MATCH (§11, §27): Admin / Club Manager / Center Sevak;
 * Captain / Vice-Captain for Leather tournaments only. Server RBAC still enforces scope.
 */
export function canScheduleTournamentMatches(
  user: AuthUser | null | undefined,
  options?: { ballType?: BallTypeValue | null; tournamentId?: string },
): boolean {
  return canScheduleTournamentMatchesFromTypes(user, options);
}

/** Admin / Club Manager / Center Sevak — unrestricted tournament match scheduling. */
export function canScheduleTournamentMatchesAsOrganizer(
  user: AuthUser | null | undefined,
): boolean {
  return canScheduleTournamentMatchesAsOrganizerFromTypes(user);
}
