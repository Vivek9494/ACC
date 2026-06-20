import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { ProfileMenu } from './ProfileMenu';
import { Text } from './Text';
import { FIELD_ORANGE } from './fieldStyles';

export interface ScreenHeaderProps {
  onBack?: () => void;
  /** Optional centered title below the icon row (e.g. screen name). */
  title?: string;
  /** When true, title uses brand orange (e.g. Poll Results). */
  accentTitle?: boolean;
  showProfileMenu?: boolean;
  /** Tighter padding for dense screens (e.g. live scoring). */
  compact?: boolean;
}

/** Standard stack header: primary back arrow + optional title + profile menu. */
export function ScreenHeader({
  onBack,
  title,
  accentTitle = false,
  showProfileMenu = true,
  compact = false,
}: ScreenHeaderProps): React.ReactElement {
  const router = useRouter();

  function handleBack(): void {
    if (onBack) {
      onBack();
      return;
    }
    router.back();
  }

  return (
    <View className={`gap-2 px-4 ${compact ? 'py-1' : 'py-3'}`}>
      <View className="flex-row items-center justify-between">
        <Pressable
          onPress={handleBack}
          className={`${compact ? 'h-9 w-9' : 'h-10 w-10'} items-center justify-center rounded-full active:bg-black/5`}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={FIELD_ORANGE} />
        </Pressable>
        {showProfileMenu ? <ProfileMenu /> : <View className={compact ? 'h-9 w-9' : 'h-10 w-10'} />}
      </View>
      {title ? (
        <Text
          className={`font-sans-bold text-xl ${accentTitle ? 'text-primary' : 'text-on-surface'}`}
        >
          {title}
        </Text>
      ) : null}
    </View>
  );
}
