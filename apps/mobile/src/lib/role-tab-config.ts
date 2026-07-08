import { UserRole, type AuthUser } from '@acc/types';
import type { Href } from 'expo-router';
import { usePathname, useRouter } from 'expo-router';
import { useMemo } from 'react';

import { ADMIN_TABS } from '../../app/admin/(tabs)/_layout';
import type { DashboardTabConfig } from '../components/dashboard/DashboardScaffold';
import type { BottomTabItem } from '../components/ui/BottomTabBar';
import { useAuth } from './auth-context';
import { useCenterSevakTabConfig } from './center-sevak-tabs';
import { usePlayerTabConfig } from './player-tabs';
import { navigateRoleTab } from './role-tab-navigation';

const ADMIN_TAB_ROUTES: Record<string, Href> = {
  index: '/admin',
  tournaments: '/admin/tournaments',
  users: '/admin/users',
  geography: '/admin/geography',
  settings: '/admin/settings',
};

function useStaticTabConfig(
  tabs: BottomTabItem[],
  routes: Record<string, Href>,
  activeKey: string,
): DashboardTabConfig {
  const router = useRouter();
  const pathname = usePathname();
  return useMemo(
    () => ({
      tabs,
      activeKey,
      onTabPress: (key: string) => {
        const href = routes[key];
        if (href) {
          navigateRoleTab(router, pathname, href);
        }
      },
    }),
    [activeKey, pathname, router, routes, tabs],
  );
}

function resolveRoleTabKey(user: AuthUser | null): 'admin' | 'centerSevak' | 'player' {
  if (user?.role === UserRole.Admin) {
    return 'admin';
  }
  if (user?.role === UserRole.CenterSevak || (user?.centerSevakCenterIds?.length ?? 0) > 0) {
    return 'centerSevak';
  }
  return 'player';
}

/**
 * Bottom tab bar config for stack screens outside a role hub (admin overlays, legacy shells).
 * Roles with a persistent `(tabs)/_layout` bar use that layout instead.
 */
export function useRoleTabConfig(activeKey = 'index'): DashboardTabConfig {
  const { user } = useAuth();
  const playerConfig = usePlayerTabConfig(activeKey);
  const centerSevakConfig = useCenterSevakTabConfig(activeKey);
  const adminConfig = useStaticTabConfig(ADMIN_TABS, ADMIN_TAB_ROUTES, activeKey);

  const roleKey = resolveRoleTabKey(user);

  if (roleKey === 'admin') {
    return adminConfig;
  }
  if (roleKey === 'centerSevak') {
    return centerSevakConfig;
  }
  return playerConfig;
}
