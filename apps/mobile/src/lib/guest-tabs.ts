import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import type { DashboardTabConfig } from '../components/dashboard/DashboardScaffold';
import type { BottomTabItem } from '../components/ui/BottomTabBar';

/** Guest bottom tabs — Home and Matches only (spec §2). */
export const GUEST_TABS: BottomTabItem[] = [
  { key: 'index', label: 'Home', icon: 'home-outline' },
  { key: 'matches', label: 'Matches', icon: 'football-outline' },
];

export const GUEST_TAB_ROUTES: Record<string, Href> = {
  index: '/guest',
  matches: '/guest/matches',
};

export function useGuestTabConfig(activeKey: string): DashboardTabConfig {
  const router = useRouter();

  return useMemo(
    () => ({
      tabs: GUEST_TABS,
      activeKey,
      onTabPress: (key: string) => {
        const href = GUEST_TAB_ROUTES[key];
        if (href) {
          router.push(href);
        }
      },
    }),
    [activeKey, router],
  );
}
