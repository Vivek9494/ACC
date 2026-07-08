import { Slot } from 'expo-router';
import { View } from 'react-native';

import { ClubManagerTabBar } from '../../../src/components/dashboard/ClubManagerTabBar';

/** Tab roots + tournament detail — persistent bottom bar (same pattern as admin tabs layout). */
export default function ClubManagerTabsLayout(): React.ReactElement {
  return (
    <View className="flex-1 bg-background">
      <View className="flex-1">
        <Slot />
      </View>
      <ClubManagerTabBar />
    </View>
  );
}
