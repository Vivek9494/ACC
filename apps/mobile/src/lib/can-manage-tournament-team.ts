import { type AuthUser, UserRole } from '@acc/types';

/** Admin / Club Manager team row actions (edit, delete). Server enforces organizer scope for CM. */
export function canManageTournamentTeam(user: AuthUser | null | undefined): boolean {
  if (!user) {
    return false;
  }
  return user.role === UserRole.Admin || user.role === UserRole.ClubManager;
}
