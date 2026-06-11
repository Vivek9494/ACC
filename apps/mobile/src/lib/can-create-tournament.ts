import { type AuthUser, UserRole } from '@acc/types';

/** Roles permitted to open the Add Tournament flow (backend enforces per-type RBAC). */
export function canCreateTournament(user: AuthUser | null | undefined): boolean {
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
