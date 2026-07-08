import { type AuthUser, UserRole } from '@acc/types';

/**
 * Optimistic UI gate for EDIT_TOURNAMENT (§6.3 team setup): Admin and Club Manager
 * everywhere; Center Sevak when organizing. Server RBAC enforces scope for Sevak.
 */
export function canCreateTournamentTeam(user: AuthUser | null | undefined): boolean {
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
