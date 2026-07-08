import type { Href } from 'expo-router';

import type { BottomTabItem } from '../components/ui/BottomTabBar';
import { hrefToPath, navigateRoleTabGroup, roleHubActiveTabKey } from './role-tab-navigation';

export const CLUB_MANAGER_ROLE_ROOT = '/club-manager';

/** Global My Matches screen — distinct from tournament inner TournamentMatches tab. */
export const CLUB_MANAGER_MY_MATCHES_ROUTE = '/club-manager/my-matches' as const;

/** Club Manager bottom tabs — Home, Tournaments, Matches (My Matches), Stats, Users. */
export const MANAGER_TABS: BottomTabItem[] = [
  { key: 'index', label: 'Home', icon: 'home-outline' },
  { key: 'tournaments', label: 'Tournaments', icon: 'trophy-outline' },
  {
    key: 'my-matches',
    label: 'Matches',
    icon: 'cricket',
    iconLibrary: 'material-community',
  },
  { key: 'stats', label: 'Stats', icon: 'stats-chart-outline' },
  { key: 'users', label: 'Users', icon: 'people-outline' },
];

export const MANAGER_TAB_ROUTES: Record<string, Href> = {
  index: '/club-manager',
  tournaments: '/club-manager/tournaments',
  'my-matches': CLUB_MANAGER_MY_MATCHES_ROUTE,
  stats: '/club-manager/stats',
  users: '/club-manager/users',
};

/** Highlight key for the persistent role tab bar from the current pathname. */
export function clubManagerActiveTabKey(pathname: string): string {
  return roleHubActiveTabKey(pathname, CLUB_MANAGER_ROLE_ROOT, MANAGER_TABS);
}

/** Routes pushed on the club-manager stack above (tabs), e.g. user detail. */
function isClubManagerStackOverlayPath(current: string): boolean {
  return /^\/club-manager\/users\/[^/]+$/.test(current);
}

type ClubManagerTabRouter = {
  dismissAll: () => void;
  replace: (href: Href, options?: { withAnchor?: boolean }) => void;
};

/**
 * Switch club-manager bottom tabs in one press.
 *
 * Tab-group routes (including tournament detail) use a direct replace.
 * Stack overlays above (tabs) dismiss first, then replace.
 */
export function navigateClubManagerTab(
  router: ClubManagerTabRouter,
  pathname: string,
  href: Href,
): void {
  navigateRoleTabGroup(router, pathname, href, isClubManagerStackOverlayPath);
}
