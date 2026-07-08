import { usePathname, useRouter } from 'expo-router';

import {
  PLAYER_TAB_ROUTES,
  PLAYER_TABS,
  navigatePlayerTab,
  playerActiveTabKey,
} from '../../lib/player-tabs';
import { BottomTabBar } from '../ui/BottomTabBar';

/** Player bottom tab bar — rendered by `home/(tabs)/_layout`. */
export function PlayerTabBar(): React.ReactElement {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <BottomTabBar
      tabs={PLAYER_TABS}
      activeKey={playerActiveTabKey(pathname)}
      onTabPress={(key: string) => {
        const href = PLAYER_TAB_ROUTES[key];
        if (href) {
          navigatePlayerTab(router, pathname, href);
        }
      }}
    />
  );
}
