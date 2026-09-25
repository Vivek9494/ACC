import type { AuthUser } from '@acc/types';

import { hasTeamLeadAccess } from './team-lead-access';

/** Matches GET /captain/dashboard eligibility (Cap/VC RoleAssignment only). */
export function canUseCaptainDashboard(user: AuthUser | null | undefined): boolean {
  if (!user || user.mustChangePassword) {
    return false;
  }
  return hasTeamLeadAccess(user);
}
