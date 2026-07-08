import { UserRole, type AuthUser } from '@acc/types';

import { hasTeamLeadAccess } from './team-lead-access';

/** Matches GET /captain/dashboard eligibility. */
export function canUseCaptainDashboard(user: AuthUser | null | undefined): boolean {
  if (!user || user.mustChangePassword) {
    return false;
  }
  if (user.role === UserRole.Captain || user.role === UserRole.ViceCaptain) {
    return true;
  }
  return hasTeamLeadAccess(user);
}
