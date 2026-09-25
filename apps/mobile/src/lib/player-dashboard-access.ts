import { UserRole, type AuthUser } from '@acc/types';

import { hasTeamLeadAccess } from './team-lead-access';

/** Matches GET /player/dashboard eligibility (Player without Cap/VC assignment). */
export function canUsePlayerDashboard(user: AuthUser | null | undefined): boolean {
  if (!user || user.mustChangePassword) {
    return false;
  }
  if (user.role !== UserRole.Player) {
    return false;
  }
  return !hasTeamLeadAccess(user);
}
