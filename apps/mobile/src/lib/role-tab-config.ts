import { UserRole, type AuthUser } from '@acc/types';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import { ADMIN_TABS } from '../../app/admin/(tabs)/_layout';
import { MANAGER_TABS } from '../../app/club-manager/(tabs)/_layout';
import type { DashboardTabConfig } from '../components/dashboard/DashboardScaffold';
import type { BottomTabItem } from '../components/ui/BottomTabBar';
import { useAuth } from './auth-context';
import { useCenterSevakTabConfig } from './center-sevak-tabs';
import { usePlayerTabConfig } from './player-tabs';

const ADMIN_TAB_ROUTES: Record<string, Href> = {
  index: '/admin',
  tournaments: '/admin/tournaments',
  users: '/admin/users',
  geography: '/admin/geography',
  profile: '/admin/profile',
};

const MANAGER_TAB_ROUTES: Record<string, Href> = {
  index: '/club-manager',
  matches: '/club-manager/matches',
  stats: '/club-manager/stats',
  users: '/club-manager/users',
  messages: '/club-manager/messages',
};

function useStaticTabConfig(
  tabs: BottomTabItem[],
  routes: Record<string, Href>,
  activeKey: string,
): DashboardTabConfig {
  const router = useRouter();
  return useMemo(
    () => ({
      tabs,
      activeKey,
      onTabPress: (key: string) => {
        const href = routes[key];
        if (href) {
          router.push(href);
        }
      },
    }),
    [activeKey, router, routes, tabs],
  );
}

function resolveRoleTabKey(user: AuthUser | null): 'admin' | 'manager' | 'centerSevak' | 'player' {
  if (user?.role === UserRole.Admin) {
    return 'admin';
  }
  if (user?.role === UserRole.ClubManager) {
    return 'manager';
  }
  if (user?.role === UserRole.CenterSevak || (user?.centerSevakCenterIds?.length ?? 0) > 0) {
    return 'centerSevak';
  }
  return 'player';
}

/** Bottom tab bar config for the signed-in role (Add Tournament and other stack screens). */
export function useRoleTabConfig(activeKey = 'index'): DashboardTabConfig {
  const { user } = useAuth();
  const playerConfig = usePlayerTabConfig(activeKey);
  const centerSevakConfig = useCenterSevakTabConfig(activeKey);
  const adminConfig = useStaticTabConfig(ADMIN_TABS, ADMIN_TAB_ROUTES, activeKey);
  const managerConfig = useStaticTabConfig(MANAGER_TABS, MANAGER_TAB_ROUTES, activeKey);

  const roleKey = resolveRoleTabKey(user);

  if (roleKey === 'admin') {
    return adminConfig;
  }
  if (roleKey === 'manager') {
    return managerConfig;
  }
  if (roleKey === 'centerSevak') {
    return centerSevakConfig;
  }
  return playerConfig;
}
