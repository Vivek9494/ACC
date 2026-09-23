import type { AdminPasswordResetOtpDayUser } from '@acc/types';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAdminPasswordResetOtpByDay } from '../../lib/api';
import { logFetchError } from '../../lib/fetch-error';
import { PlayerAvatar } from '../tournament/PlayerAvatar';
import { ScreenHeader } from '../ui/ScreenHeader';
import { FIELD_ORANGE } from '../ui/fieldStyles';
import { Text } from '../ui/Text';
import { formatPasswordResetOtpDayLabel } from './password-reset-otp-display';

function DayUserRow({ user }: { user: AdminPasswordResetOtpDayUser }): React.ReactElement {
  return (
    <View className="flex-row items-center gap-3 border-b border-outline-variant py-3">
      <PlayerAvatar
        firstName={user.firstName}
        profilePhotoUrl={user.profilePhotoUrl}
        size="sm"
      />
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="font-sans-semibold text-base text-on-surface" numberOfLines={1}>
          {user.firstName} {user.lastName}
        </Text>
        <Text className="font-sans text-sm text-on-surface-variant" numberOfLines={1}>
          {user.mobileNumber}
        </Text>
      </View>
      <Text className="font-sans-bold text-base text-primary">{user.count}</Text>
    </View>
  );
}

/** Admin stack: OTP recipients for one UTC calendar day. */
export function AdminPasswordResetOtpDayRecipientsScreen(): React.ReactElement {
  const { date: dateParam } = useLocalSearchParams<{ date: string }>();
  const date = typeof dateParam === 'string' ? dateParam : dateParam?.[0] ?? '';
  const [users, setUsers] = useState<AdminPasswordResetOtpDayUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('Invalid date.');
      setLoading(false);
      setUsers([]);
      return () => undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getAdminPasswordResetOtpByDay(date)
      .then((data) => {
        if (!cancelled) setUsers(data.users);
      })
      .catch((err: unknown) => {
        logFetchError('Failed to load password-reset OTP day users', err);
        if (!cancelled) {
          setError("Couldn't load users for this day.");
          setUsers([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

  useEffect(() => load(), [load]);

  const title = date
    ? `${formatPasswordResetOtpDayLabel(date)} · OTP recipients`
    : 'OTP recipients';

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScreenHeader title={title} />
      {loading ? (
        <View className="flex-1 items-center justify-center py-16">
          <ActivityIndicator color={FIELD_ORANGE} />
        </View>
      ) : error ? (
        <View className="px-4 py-8">
          <Text className="font-sans text-base text-secondary">{error}</Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.userId}
          contentContainerClassName="px-4 pb-8"
          ListEmptyComponent={
            <Text className="py-16 text-center font-sans text-base text-on-surface-variant">
              No password-reset OTPs sent this day.
            </Text>
          }
          renderItem={({ item }) => <DayUserRow user={item} />}
        />
      )}
    </SafeAreaView>
  );
}
