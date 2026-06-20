import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { colors } from '@/theme/colors';

import { INPUT_SHADOW_STYLE } from './fieldStyles';
import { Text } from './Text';

export interface GuestHeaderProps {
  onProfilePress?: () => void;
}

/** Minimal guest dashboard header — generic profile icon only (spec §2). */
export function GuestHeader({ onProfilePress }: GuestHeaderProps): React.ReactElement {
  return (
    <View className="flex-row items-center justify-end">
      <Pressable
        onPress={onProfilePress}
        accessibilityRole="button"
        accessibilityLabel="Sign in or create account"
        className="h-10 w-10 items-center justify-center rounded-full bg-surface active:opacity-90"
        style={INPUT_SHADOW_STYLE}
      >
        <Ionicons name="person-circle-outline" size={28} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}
