import { UserRole, type AuthUser } from '@acc/types';

import { hasTeamLeadAccess } from './team-lead-access';

/** Matches GET /player/dashboard eligibility (Player or Manager without team-lead assignment). */
export function canUsePlayerDashboard(user: AuthUser | null | undefined): boolean {
  if (!user || user.mustChangePassword) {
    return false;
  }
  if (user.role !== UserRole.Player && user.role !== UserRole.Manager) {
    return false;
  }
  return !hasTeamLeadAccess(user);
}
