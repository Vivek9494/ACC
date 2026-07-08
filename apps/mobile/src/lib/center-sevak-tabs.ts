import type { Href } from 'expo-router';
import { usePathname, useRouter } from 'expo-router';
import { useMemo } from 'react';

import type { DashboardTabConfig } from '../components/dashboard/DashboardScaffold';
import type { BottomTabItem } from '../components/ui/BottomTabBar';
import { navigateRoleTab, navigateRoleTabGroup, roleHubActiveTabKey } from './role-tab-navigation';

export const CENTER_SEVAK_ROLE_ROOT = '/center-sevak';

/** Center Sevak bottom tabs — no Users tab, no tournament creation. */
export const CENTER_SEVAK_TABS: BottomTabItem[] = [
  { key: 'index', label: 'Home', icon: 'home-outline' },
  { key: 'tournaments', label: 'Tournaments', icon: 'trophy-outline' },
  { key: 'matches', label: 'Matches', icon: 'cricket', iconLibrary: 'material-community' },
  { key: 'stats', label: 'Stats', icon: 'stats-chart-outline' },
];

export const CENTER_SEVAK_TAB_ROUTES: Record<string, Href> = {
  index: '/center-sevak',
  tournaments: '/center-sevak/tournaments',
  matches: '/center-sevak/matches',
  stats: '/center-sevak/stats',
};

export function centerSevakActiveTabKey(pathname: string): string {
  return roleHubActiveTabKey(pathname, CENTER_SEVAK_ROLE_ROOT, CENTER_SEVAK_TABS);
}

type CenterSevakTabRouter = {
  dismissAll: () => void;
  replace: (href: Href, options?: { withAnchor?: boolean }) => void;
};

export function navigateCenterSevakTab(
  router: CenterSevakTabRouter,
  pathname: string,
  href: Href,
): void {
  navigateRoleTabGroup(router, pathname, href, () => false);
}

export function useCenterSevakTabConfig(activeKey: string): DashboardTabConfig {
  const router = useRouter();
  const pathname = usePathname();

  return useMemo(
    () => ({
      tabs: CENTER_SEVAK_TABS,
      activeKey,
      onTabPress: (key: string) => {
        const href = CENTER_SEVAK_TAB_ROUTES[key];
        if (href) {
          navigateRoleTab(router, pathname, href);
        }
      },
    }),
    [activeKey, pathname, router],
  );
}
