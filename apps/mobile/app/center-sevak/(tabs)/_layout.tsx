import { Slot } from 'expo-router';
import { View } from 'react-native';

/** Tab bar is rendered by each screen (DashboardScaffold on Home, CenterSevakTabShell elsewhere). */
export default function CenterSevakTabsLayout(): React.ReactElement {
  return (
    <View className="flex-1 bg-surface">
      <Slot />
    </View>
  );
}
