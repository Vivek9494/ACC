import { Slot, usePathname } from 'expo-router';
import { View } from 'react-native';

import { ClubManagerTabBar } from '../../../src/components/dashboard/ClubManagerTabBar';
import { shouldHideRoleTabBarForPath } from '../../../src/lib/tournament-detail-route';

/** Tab roots + tournament detail — persistent bottom bar (same pattern as admin tabs layout). */
export default function ClubManagerTabsLayout(): React.ReactElement {
  const pathname = usePathname();
  const hideTabBar = shouldHideRoleTabBarForPath(pathname);

  return (
    <View className="flex-1 bg-background">
      <View className="flex-1">
        <Slot />
      </View>
      {hideTabBar ? null : <ClubManagerTabBar />}
    </View>
  );
}
