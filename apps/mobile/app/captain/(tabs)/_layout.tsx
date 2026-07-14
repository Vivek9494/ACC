import { Slot, usePathname } from 'expo-router';
import { View } from 'react-native';

import { CaptainTabBar } from '../../../src/components/dashboard/CaptainTabBar';
import { shouldHideRoleTabBarForPath } from '../../../src/lib/tournament-detail-route';

/** Captain tab roots + tournament detail — persistent bottom bar. */
export default function CaptainTabsLayout(): React.ReactElement {
  const pathname = usePathname();
  const hideTabBar = shouldHideRoleTabBarForPath(pathname);

  return (
    <View className="flex-1 bg-background">
      <View className="flex-1">
        <Slot />
      </View>
      {hideTabBar ? null : <CaptainTabBar />}
    </View>
  );
}
