import type { Href } from 'expo-router';
import { usePathname, useRouter } from 'expo-router';
import { useMemo } from 'react';

import type { DashboardTabConfig } from '../components/dashboard/DashboardScaffold';
import type { BottomTabItem } from '../components/ui/BottomTabBar';
import { navigateRoleTab, navigateRoleTabGroup, roleHubActiveTabKey } from './role-tab-navigation';

export const PLAYER_ROLE_ROOT = '/home';

/** Player bottom tabs — Home, Tournaments, Matches, Stats. */
export const PLAYER_TABS: BottomTabItem[] = [
  { key: 'index', label: 'Home', icon: 'home-outline' },
  { key: 'tournaments', label: 'Tournaments', icon: 'trophy-outline' },
  { key: 'matches', label: 'Matches', icon: 'cricket', iconLibrary: 'material-community' },
  { key: 'stats', label: 'Stats', icon: 'stats-chart-outline' },
];

export const PLAYER_TAB_ROUTES: Record<string, Href> = {
  index: '/home',
  tournaments: '/home/tournaments',
  matches: '/home/matches',
  stats: '/home/stats',
};

export function playerActiveTabKey(pathname: string): string {
  return roleHubActiveTabKey(pathname, PLAYER_ROLE_ROOT, PLAYER_TABS);
}

type PlayerTabRouter = {
  dismissAll: () => void;
  replace: (href: Href, options?: { withAnchor?: boolean }) => void;
};

export function navigatePlayerTab(
  router: PlayerTabRouter,
  pathname: string,
  href: Href,
): void {
  navigateRoleTabGroup(router, pathname, href, () => false);
}

/** Role-specific tab bar config for DashboardScaffold and tab placeholder screens. */
export function usePlayerTabConfig(activeKey: string): DashboardTabConfig {
  const router = useRouter();
  const pathname = usePathname();

  return useMemo(
    () => ({
      tabs: PLAYER_TABS,
      activeKey,
      onTabPress: (key: string) => {
        const href = PLAYER_TAB_ROUTES[key];
        if (href) {
          navigateRoleTab(router, pathname, href);
        }
      },
    }),
    [activeKey, pathname, router],
  );
}
