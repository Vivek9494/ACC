import { Slot, usePathname, useRouter, type Href } from 'expo-router';
import { View } from 'react-native';

import { BottomTabBar, type BottomTabItem } from '../../../src/components/ui/BottomTabBar';

export const MANAGER_TABS: BottomTabItem[] = [
  { key: 'index', label: 'Home', icon: 'home-outline' },
  { key: 'matches', label: 'Matches', icon: 'football-outline' },
  { key: 'stats', label: 'Stats', icon: 'stats-chart-outline' },
  { key: 'users', label: 'Users', icon: 'people-outline' },
  { key: 'messages', label: 'Messages', icon: 'chatbubble-outline' },
];

function activeTabKey(pathname: string): string {
  const segment = pathname.replace(/\/$/, '').split('/').pop() ?? 'index';
  if (segment === 'club-manager') {
    return 'index';
  }
  return MANAGER_TABS.some((tab) => tab.key === segment) ? segment : 'index';
}

const TAB_ROUTES: Record<string, Href> = {
  index: '/club-manager',
  matches: '/club-manager/matches',
  stats: '/club-manager/stats',
  users: '/club-manager/users',
  messages: '/club-manager/messages',
};

export default function ClubManagerTabsLayout(): React.ReactElement {
  const pathname = usePathname();
  const router = useRouter();
  const activeKey = activeTabKey(pathname);

  return (
    <View className="flex-1 bg-background">
      <View className="flex-1">
        <Slot />
      </View>
      <BottomTabBar
        tabs={MANAGER_TABS}
        activeKey={activeKey}
        onTabPress={(key: string) => {
          const href = TAB_ROUTES[key];
          if (href) {
            router.push(href);
          }
        }}
      />
    </View>
  );
}
