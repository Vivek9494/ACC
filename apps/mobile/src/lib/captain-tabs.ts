import type { Href } from 'expo-router';
import { usePathname, useRouter } from 'expo-router';
import { useMemo } from 'react';

import type { DashboardTabConfig } from '../components/dashboard/DashboardScaffold';
import type { BottomTabItem } from '../components/ui/BottomTabBar';
import { navigateRoleTab, navigateRoleTabGroup, roleHubActiveTabKey } from './role-tab-navigation';

export const CAPTAIN_ROLE_ROOT = '/captain';

/** Captain / Vice-Captain bottom tabs — no Users tab. */
export const CAPTAIN_TABS: BottomTabItem[] = [
  { key: 'index', label: 'Home', icon: 'home-outline' },
  { key: 'tournaments', label: 'Tournaments', icon: 'trophy-outline' },
  { key: 'matches', label: 'Matches', icon: 'cricket', iconLibrary: 'material-community' },
  { key: 'stats', label: 'Stats', icon: 'stats-chart-outline' },
];

export const CAPTAIN_TAB_ROUTES: Record<string, Href> = {
  index: '/captain',
  tournaments: '/captain/tournaments',
  matches: '/captain/matches',
  stats: '/captain/stats',
};

export function captainActiveTabKey(pathname: string): string {
  return roleHubActiveTabKey(pathname, CAPTAIN_ROLE_ROOT, CAPTAIN_TABS);
}

type CaptainTabRouter = {
  dismissAll: () => void;
  replace: (href: Href, options?: { withAnchor?: boolean }) => void;
};

export function navigateCaptainTab(
  router: CaptainTabRouter,
  pathname: string,
  href: Href,
): void {
  navigateRoleTabGroup(router, pathname, href, () => false);
}

/** Role-specific tab bar config for DashboardScaffold and tab placeholder screens. */
export function useCaptainTabConfig(activeKey: string): DashboardTabConfig {
  const router = useRouter();
  const pathname = usePathname();

  return useMemo(
    () => ({
      tabs: CAPTAIN_TABS,
      activeKey,
      onTabPress: (key: string) => {
        const href = CAPTAIN_TAB_ROUTES[key];
        if (href) {
          navigateRoleTab(router, pathname, href);
        }
      },
    }),
    [activeKey, pathname, router],
  );
}
