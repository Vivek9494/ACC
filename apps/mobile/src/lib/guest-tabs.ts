import type { Href } from 'expo-router';
import { usePathname, useRouter } from 'expo-router';
import { useMemo } from 'react';

import type { DashboardTabConfig } from '../components/dashboard/DashboardScaffold';
import type { BottomTabItem } from '../components/ui/BottomTabBar';
import { navigateRoleTab } from './role-tab-navigation';

/** Guest bottom tabs — Home and Tournaments (spec §2). */
export const GUEST_TABS: BottomTabItem[] = [
  { key: 'index', label: 'Home', icon: 'home-outline' },
  { key: 'tournaments', label: 'Tournaments', icon: 'trophy-outline' },
];

export const GUEST_TAB_ROUTES: Record<string, Href> = {
  index: '/guest',
  tournaments: '/guest/tournaments',
};

export function useGuestTabConfig(activeKey: string): DashboardTabConfig {
  const router = useRouter();
  const pathname = usePathname();

  return useMemo(
    () => ({
      tabs: GUEST_TABS,
      activeKey,
      onTabPress: (key: string) => {
        const href = GUEST_TAB_ROUTES[key];
        if (href) {
          navigateRoleTab(router, pathname, href);
        }
      },
    }),
    [activeKey, pathname, router],
  );
}
