import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';

import { useAuth } from '../../lib/auth-context';
import { resolveBirthdaysHref } from '../../lib/birthday-route';
import { FIELD_ORANGE } from './fieldStyles';

export interface BirthdayHeaderButtonProps {
  compact?: boolean;
}

/** Opens today's birthdays list — shown before profile (and broadcast when present). */
export function BirthdayHeaderButton({
  compact = false,
}: BirthdayHeaderButtonProps): React.ReactElement | null {
  const { user } = useAuth();
  const router = useRouter();
  const href = user ? resolveBirthdaysHref(user) : null;

  if (!href) {
    return null;
  }

  const sizeClass = compact ? 'h-9 w-9' : 'h-10 w-10';

  return (
    <Pressable
      onPress={() => router.push(href)}
      accessibilityRole="button"
      accessibilityLabel="Birthdays"
      className={`${sizeClass} shrink-0 items-center justify-center rounded-full active:bg-black/5`}
    >
      <MaterialCommunityIcons
        name="cake-variant"
        size={compact ? 22 : 24}
        color={FIELD_ORANGE}
      />
    </Pressable>
  );
}
