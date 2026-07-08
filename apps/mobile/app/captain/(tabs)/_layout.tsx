import { Slot } from 'expo-router';
import { View } from 'react-native';

import { CaptainTabBar } from '../../../src/components/dashboard/CaptainTabBar';

/** Captain tab roots + tournament detail — persistent bottom bar. */
export default function CaptainTabsLayout(): React.ReactElement {
  return (
    <View className="flex-1 bg-background">
      <View className="flex-1">
        <Slot />
      </View>
      <CaptainTabBar />
    </View>
  );
}
