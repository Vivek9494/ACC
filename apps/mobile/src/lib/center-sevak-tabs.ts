import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import type { DashboardTabConfig } from '../components/dashboard/DashboardScaffold';
import type { BottomTabItem } from '../components/ui/BottomTabBar';

/** Center Sevak bottom tabs — no Users tab, no tournament creation. */
export const CENTER_SEVAK_TABS: BottomTabItem[] = [
  { key: 'index', label: 'Home', icon: 'home-outline' },
  { key: 'matches', label: 'Matches', icon: 'football-outline' },
  { key: 'stats', label: 'Stats', icon: 'stats-chart-outline' },
  { key: 'messages', label: 'Messages', icon: 'chatbubble-outline' },
];

export const CENTER_SEVAK_TAB_ROUTES: Record<string, Href> = {
  index: '/center-sevak',
  matches: '/center-sevak/matches',
  stats: '/center-sevak/stats',
  messages: '/center-sevak/messages',
};

export function useCenterSevakTabConfig(activeKey: string): DashboardTabConfig {
  const router = useRouter();

  return useMemo(
    () => ({
      tabs: CENTER_SEVAK_TABS,
      activeKey,
      onTabPress: (key: string) => {
        const href = CENTER_SEVAK_TAB_ROUTES[key];
        if (href) {
          router.push(href);
        }
      },
    }),
    [activeKey, router],
  );
}
