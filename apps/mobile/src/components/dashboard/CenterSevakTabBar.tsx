import { usePathname, useRouter } from 'expo-router';

import {
  CENTER_SEVAK_TAB_ROUTES,
  CENTER_SEVAK_TABS,
  centerSevakActiveTabKey,
  navigateCenterSevakTab,
} from '../../lib/center-sevak-tabs';
import { BottomTabBar } from '../ui/BottomTabBar';

/** Center Sevak bottom tab bar — rendered by `center-sevak/(tabs)/_layout`. */
export function CenterSevakTabBar(): React.ReactElement {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <BottomTabBar
      tabs={CENTER_SEVAK_TABS}
      activeKey={centerSevakActiveTabKey(pathname)}
      onTabPress={(key: string) => {
        const href = CENTER_SEVAK_TAB_ROUTES[key];
        if (href) {
          navigateCenterSevakTab(router, pathname, href);
        }
      }}
    />
  );
}
