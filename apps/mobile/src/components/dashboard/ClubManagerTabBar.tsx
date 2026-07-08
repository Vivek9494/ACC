import { usePathname, useRouter } from 'expo-router';

import {
  MANAGER_TAB_ROUTES,
  MANAGER_TABS,
  clubManagerActiveTabKey,
  navigateClubManagerTab,
} from '../../lib/club-manager-tabs';
import { BottomTabBar } from '../ui/BottomTabBar';

/** Club Manager bottom tab bar — rendered by `(tabs)/_layout` so it stays visible on tournament detail. */
export function ClubManagerTabBar(): React.ReactElement {
  const pathname = usePathname();
  const router = useRouter();
  const activeKey = clubManagerActiveTabKey(pathname);

  return (
    <BottomTabBar
      tabs={MANAGER_TABS}
      activeKey={activeKey}
      onTabPress={(key: string) => {
        const href = MANAGER_TAB_ROUTES[key];
        if (href) {
          navigateClubManagerTab(router, pathname, href);
        }
      }}
    />
  );
}
