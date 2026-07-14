import { Slot, usePathname } from 'expo-router';
import { View } from 'react-native';

import { CenterSevakTabBar } from '../../../src/components/dashboard/CenterSevakTabBar';
import { shouldHideRoleTabBarForPath } from '../../../src/lib/tournament-detail-route';

/** Center Sevak tab roots + tournament detail — persistent bottom bar. */
export default function CenterSevakTabsLayout(): React.ReactElement {
  const pathname = usePathname();
  const hideTabBar = shouldHideRoleTabBarForPath(pathname);

  return (
    <View className="flex-1 bg-background">
      <View className="flex-1">
        <Slot />
      </View>
      {hideTabBar ? null : <CenterSevakTabBar />}
    </View>
  );
}
