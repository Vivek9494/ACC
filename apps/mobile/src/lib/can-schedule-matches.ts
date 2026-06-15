import { type AuthUser, UserRole } from '@acc/types';

/**
 * Optimistic UI gate for CREATE_MATCH (§11, §27): Admin everywhere; Club Manager and
 * Center Sevak when organizing. Server RBAC still enforces organizer scope per tournament.
 */
export function canScheduleTournamentMatches(user: AuthUser | null | undefined): boolean {
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
