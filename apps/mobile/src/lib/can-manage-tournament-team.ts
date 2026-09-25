import { type AuthUser, UserRole } from '@acc/types';

/**
 * Optimistic UI gate for team row edit/delete — same roles as create team.
 * Server EDIT_TOURNAMENT enforces organizer scope (participating Sevak on multi-center).
 */
export function canManageTournamentTeam(user: AuthUser | null | undefined): boolean {
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
