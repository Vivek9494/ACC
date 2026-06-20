import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { useAuth } from '../../lib/auth-context';
import { ProfileMenu } from './ProfileMenu';
import { Text } from './Text';
import { FIELD_ORANGE, INPUT_SHADOW_STYLE } from './fieldStyles';

export interface DashboardHeaderProps {
  /** Shown when the user record is not yet loaded. */
  fallbackName?: string;
}

/** Greeting row with notifications bell and profile menu — shared across dashboards. */
export function DashboardHeader({ fallbackName = 'User' }: DashboardHeaderProps): React.ReactElement {
  const { user } = useAuth();

  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-1 gap-1">
        <Text className="font-sans text-base text-on-surface-variant">Jay Swaminarayan,</Text>
        <Text className="font-sans-bold text-2xl text-primary">
          {user?.firstName ?? fallbackName}
        </Text>
      </View>
      <View className="flex-row items-center gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          className="h-10 w-10 items-center justify-center rounded-full bg-surface active:opacity-90"
          style={INPUT_SHADOW_STYLE}
        >
          <Ionicons name="notifications-outline" size={22} color={FIELD_ORANGE} />
        </Pressable>
        <ProfileMenu />
      </View>
    </View>
  );
}
