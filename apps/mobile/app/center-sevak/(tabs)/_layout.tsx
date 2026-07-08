import { Slot } from 'expo-router';
import { View } from 'react-native';

import { CenterSevakTabBar } from '../../../src/components/dashboard/CenterSevakTabBar';

/** Center Sevak tab roots + tournament detail — persistent bottom bar. */
export default function CenterSevakTabsLayout(): React.ReactElement {
  return (
    <View className="flex-1 bg-background">
      <View className="flex-1">
        <Slot />
      </View>
      <CenterSevakTabBar />
    </View>
  );
}
