import { Slot, usePathname, useRouter, type Href } from 'expo-router';
import { View } from 'react-native';

import { BottomTabBar, type BottomTabItem } from '../../../src/components/ui/BottomTabBar';
import { navigateRoleTabGroup, roleHubActiveTabKey } from '../../../src/lib/role-tab-navigation';
import { shouldHideRoleTabBarForPath } from '../../../src/lib/tournament-detail-route';

export const ADMIN_TABS: BottomTabItem[] = [
  { key: 'index', label: 'Home', icon: 'home-outline' },
  { key: 'tournaments', label: 'Tournaments', icon: 'trophy-outline' },
  { key: 'users', label: 'Users', icon: 'people-outline' },
  { key: 'geography', label: 'Geography', icon: 'map-outline' },
  { key: 'settings', label: 'Settings', icon: 'settings-outline' },
];

const ADMIN_ROLE_ROOT = '/admin';

const TAB_ROUTES: Record<string, Href> = {
  index: '/admin',
  tournaments: '/admin/tournaments',
  users: '/admin/users',
  geography: '/admin/geography',
  settings: '/admin/settings',
};

function isAdminStackOverlayPath(current: string): boolean {
  return (
    /^\/admin\/users\/[^/]+$/.test(current) ||
    current === '/admin/users/new' ||
    current.startsWith('/admin/provinces') ||
    current.startsWith('/admin/centers')
  );
}

function adminActiveTabKey(pathname: string): string {
  return roleHubActiveTabKey(pathname, ADMIN_ROLE_ROOT, ADMIN_TABS);
}

export default function AdminTabsLayout(): React.ReactElement {
  const pathname = usePathname();
  const router = useRouter();
  const activeKey = adminActiveTabKey(pathname);
  const hideTabBar = shouldHideRoleTabBarForPath(pathname);

  return (
    <View className="flex-1 bg-background">
      <View className="flex-1">
        <Slot />
      </View>
      {hideTabBar ? null : (
        <BottomTabBar
          tabs={ADMIN_TABS}
          activeKey={activeKey}
          onTabPress={(key: string) => {
            const href = TAB_ROUTES[key];
            if (href) {
              navigateRoleTabGroup(router, pathname, href, isAdminStackOverlayPath);
            }
          }}
        />
      )}
    </View>
  );
}
