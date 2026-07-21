import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, type AppStateStatus, Pressable, View } from 'react-native';

import { useAuth } from '../../lib/auth-context';
import { resolveBirthdaysHref } from '../../lib/birthday-route';
import { getBirthdayTodayCount } from '../../lib/api';
import { FIELD_ORANGE } from './fieldStyles';
import { Text } from './Text';

export interface BirthdayHeaderButtonProps {
  compact?: boolean;
}

const BADGE_CAP = 9;

function formatBadgeCount(count: number): string {
  return count > BADGE_CAP ? `${BADGE_CAP}+` : String(count);
}

/** Opens today's birthdays list — shown before profile (and broadcast when present). */
export function BirthdayHeaderButton({
  compact = false,
}: BirthdayHeaderButtonProps): React.ReactElement | null {
  const { user } = useAuth();
  const router = useRouter();
  const href = user ? resolveBirthdaysHref(user) : null;
  const [todayCount, setTodayCount] = useState(0);

  const refreshTodayCount = useCallback(() => {
    if (!href) {
      setTodayCount(0);
      return;
    }
    void getBirthdayTodayCount()
      .then((result) => setTodayCount(result.count))
      .catch(() => setTodayCount(0));
  }, [href]);

  useEffect(() => {
    refreshTodayCount();
  }, [refreshTodayCount]);

  useEffect(() => {
    const onAppState = (next: AppStateStatus): void => {
      if (next === 'active') {
        refreshTodayCount();
      }
    };
    const subscription = AppState.addEventListener('change', onAppState);
    return () => subscription.remove();
  }, [refreshTodayCount]);

  if (!href) {
    return null;
  }

  const sizeClass = compact ? 'h-9 w-9' : 'h-10 w-10';
  const showBadge = todayCount > 0;

  return (
    <Pressable
      onPress={() => router.push(href)}
      accessibilityRole="button"
      accessibilityLabel={
        showBadge
          ? `Birthdays, ${todayCount} today`
          : 'Birthdays'
      }
      className={`${sizeClass} relative shrink-0 items-center justify-center rounded-full active:bg-black/5`}
    >
      <MaterialCommunityIcons
        name="cake-variant"
        size={compact ? 22 : 24}
        color={FIELD_ORANGE}
      />
      {showBadge ? (
        <View
          pointerEvents="none"
          className="absolute -right-0.5 -top-0.5 min-h-[16px] min-w-[16px] items-center justify-center rounded-full bg-primary px-1"
        >
          <Text className="font-sans-bold text-[10px] leading-[12px] text-on-primary">
            {formatBadgeCount(todayCount)}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
