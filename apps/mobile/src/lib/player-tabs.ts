import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import type { DashboardTabConfig } from '../components/dashboard/DashboardScaffold';
import type { BottomTabItem } from '../components/ui/BottomTabBar';

/** Player bottom tabs — Home, Matches, Stats, Messages. */
export const PLAYER_TABS: BottomTabItem[] = [
  { key: 'index', label: 'Home', icon: 'home-outline' },
  { key: 'matches', label: 'Matches', icon: 'football-outline' },
  { key: 'stats', label: 'Stats', icon: 'stats-chart-outline' },
  { key: 'messages', label: 'Messages', icon: 'chatbubble-outline' },
];

export const PLAYER_TAB_ROUTES: Record<string, Href> = {
  index: '/home',
  matches: '/home/matches',
  stats: '/home/stats',
  messages: '/home/messages',
};

/** Role-specific tab bar config for DashboardScaffold and tab placeholder screens. */
export function usePlayerTabConfig(activeKey: string): DashboardTabConfig {
  const router = useRouter();

  return useMemo(
    () => ({
      tabs: PLAYER_TABS,
      activeKey,
      onTabPress: (key: string) => {
        const href = PLAYER_TAB_ROUTES[key];
        if (href) {
          router.push(href);
        }
      },
    }),
    [activeKey, router],
  );
}
