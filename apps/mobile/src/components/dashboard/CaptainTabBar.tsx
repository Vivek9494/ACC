import { usePathname, useRouter } from 'expo-router';

import {
  CAPTAIN_TAB_ROUTES,
  CAPTAIN_TABS,
  captainActiveTabKey,
  navigateCaptainTab,
} from '../../lib/captain-tabs';
import { BottomTabBar } from '../ui/BottomTabBar';

/** Captain bottom tab bar — rendered by `captain/(tabs)/_layout`. */
export function CaptainTabBar(): React.ReactElement {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <BottomTabBar
      tabs={CAPTAIN_TABS}
      activeKey={captainActiveTabKey(pathname)}
      onTabPress={(key: string) => {
        const href = CAPTAIN_TAB_ROUTES[key];
        if (href) {
          navigateCaptainTab(router, pathname, href);
        }
      }}
    />
  );
}
