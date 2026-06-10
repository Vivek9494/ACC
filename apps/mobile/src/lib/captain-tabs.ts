import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import type { DashboardTabConfig } from '../components/dashboard/DashboardScaffold';
import type { BottomTabItem } from '../components/ui/BottomTabBar';

/** Captain / Vice-Captain bottom tabs — no Users tab. */
export const CAPTAIN_TABS: BottomTabItem[] = [
  { key: 'index', label: 'Home', icon: 'home-outline' },
  { key: 'matches', label: 'Matches', icon: 'football-outline' },
  { key: 'stats', label: 'Stats', icon: 'stats-chart-outline' },
  { key: 'messages', label: 'Messages', icon: 'chatbubble-outline' },
];

export const CAPTAIN_TAB_ROUTES: Record<string, Href> = {
  index: '/captain',
  matches: '/captain/matches',
  stats: '/captain/stats',
  messages: '/captain/messages',
};

/** Role-specific tab bar config for DashboardScaffold and tab placeholder screens. */
export function useCaptainTabConfig(activeKey: string): DashboardTabConfig {
  const router = useRouter();

  return useMemo(
    () => ({
      tabs: CAPTAIN_TABS,
      activeKey,
      onTabPress: (key: string) => {
        const href = CAPTAIN_TAB_ROUTES[key];
        if (href) {
          router.push(href);
        }
      },
    }),
    [activeKey, router],
  );
}
