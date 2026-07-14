import { Slot, usePathname } from 'expo-router';
import { View } from 'react-native';

import { PlayerTabBar } from '../../../src/components/dashboard/PlayerTabBar';
import { shouldHideRoleTabBarForPath } from '../../../src/lib/tournament-detail-route';

/** Player tab roots + tournament detail — persistent bottom bar. */
export default function PlayerTabsLayout(): React.ReactElement {
  const pathname = usePathname();
  const hideTabBar = shouldHideRoleTabBarForPath(pathname);

  return (
    <View className="flex-1 bg-background">
      <View className="flex-1">
        <Slot />
      </View>
      {hideTabBar ? null : <PlayerTabBar />}
    </View>
  );
}
