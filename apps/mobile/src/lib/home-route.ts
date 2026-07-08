import { UserRole, type AuthUser } from '@acc/types';
import type { Href } from 'expo-router';

import { hasCenterSevakAccess } from './center-sevak-access';
import { hasTeamLeadAccess } from './team-lead-access';

export type RoleHomeRoute =
  | '/forced-password-change'
  | '/admin'
  | '/club-manager'
  | '/captain'
  | '/center-sevak'
  | '/home';

/** Post-login destination by role and forced-password gate. */
export function homeRouteForUser(user: AuthUser | null | undefined): RoleHomeRoute {
  if (!user) {
    return '/home';
  }
  if (user.mustChangePassword) {
    return '/forced-password-change';
  }
  if (user.role === UserRole.Admin) {
    return '/admin';
  }
  if (user.role === UserRole.ClubManager) {
    return '/club-manager';
  }
  if (user.role === UserRole.CenterSevak || hasCenterSevakAccess(user)) {
    return '/center-sevak';
  }
  if (
    user.role === UserRole.Captain ||
    user.role === UserRole.ViceCaptain ||
    hasTeamLeadAccess(user)
  ) {
    return '/captain';
  }
  return '/home';
}

/** Redirect target for role-specific layout guards. */
export function homeRouteForUserAsHref(user: AuthUser | null | undefined): Href {
  return homeRouteForUser(user);
}
