import { Slot, usePathname, useRouter, type Href } from 'expo-router';
import { View } from 'react-native';

import { BottomTabBar, type BottomTabItem } from '../../../src/components/ui/BottomTabBar';

export const ADMIN_TABS: BottomTabItem[] = [
  { key: 'index', label: 'Home', icon: 'home-outline' },
  { key: 'tournaments', label: 'Tournaments', icon: 'trophy-outline' },
  { key: 'users', label: 'Users', icon: 'people-outline' },
  { key: 'geography', label: 'Geography', icon: 'map-outline' },
  { key: 'profile', label: 'Profile', icon: 'person-outline' },
];

function activeTabKey(pathname: string): string {
  const segment = pathname.replace(/\/$/, '').split('/').pop() ?? 'index';
  if (segment === 'admin') {
    return 'index';
  }
  return ADMIN_TABS.some((tab) => tab.key === segment) ? segment : 'index';
}

const TAB_ROUTES: Record<string, Href> = {
  index: '/admin',
  tournaments: '/admin/tournaments',
  users: '/admin/users',
  geography: '/admin/geography',
  profile: '/admin/profile',
};

export default function AdminTabsLayout(): React.ReactElement {
  const pathname = usePathname();
  const router = useRouter();
  const activeKey = activeTabKey(pathname);

  return (
    <View className="flex-1 bg-surface">
      <View className="flex-1">
        <Slot />
      </View>
      <BottomTabBar
        tabs={ADMIN_TABS}
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
