import { UserRole, type AuthUser } from '@acc/types';
import type { Href } from 'expo-router';

import { homeRouteForUser } from './home-route';

/** Role-scoped birthdays list route — null when the role has no birthdays screen. */
export function resolveBirthdaysHref(user: AuthUser): Href | null {
  if (user.role === UserRole.Admin) {
    return '/admin/birthdays';
  }
  if (user.role === UserRole.ClubManager) {
    return '/club-manager/birthdays';
  }

  const home = homeRouteForUser(user);
  if (home === '/captain') {
    return '/captain/birthdays';
  }
  if (home === '/home') {
    return '/home/birthdays';
  }

  return null;
}
