import { Slot } from 'expo-router';
import { View } from 'react-native';

import { PlayerTabBar } from '../../../src/components/dashboard/PlayerTabBar';

/** Player tab roots + tournament detail — persistent bottom bar. */
export default function PlayerTabsLayout(): React.ReactElement {
  return (
    <View className="flex-1 bg-background">
      <View className="flex-1">
        <Slot />
      </View>
      <PlayerTabBar />
    </View>
  );
}
