import { Ionicons } from '@expo/vector-icons';
import type { CenterPlayerRosterEntry } from '@acc/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlayerAvatarWithStatus } from '../../../src/components/tournament/verify-players/PlayerAvatarWithStatus';
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader';
import { Text } from '../../../src/components/ui/Text';
import { FIELD_ORANGE, INPUT_SHADOW_STYLE } from '../../../src/components/ui/fieldStyles';
import { ApiRequestError, getRegistrationVerificationQueue } from '../../../src/lib/api';

export default function LateRegisterPickerScreen(): React.ReactElement {
  const { tournamentId } = useLocalSearchParams<{ tournamentId: string }>();
  const router = useRouter();

  const [players, setPlayers] = useState<CenterPlayerRosterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tournamentId) {
      return;
    }
    setLoading(true);
    try {
      const queue = await getRegistrationVerificationQueue(tournamentId);
      setPlayers(queue.notRegistered);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load players.');
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    void load();
  }, [load]);

  function selectPlayer(player: CenterPlayerRosterEntry): void {
    router.push({
      pathname: '/registrations/[tournamentId]/register',
      params: {
        tournamentId: tournamentId ?? '',
        onBehalfOfUserId: player.userId,
        firstName: player.firstName,
        lastName: player.lastName,
        centerId: player.centerId,
        lateRegister: '1',
      },
    });
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScreenHeader
        title="Late registration"
        subtitle="Select a player from your center who missed the registration window."
        onBack={() => router.back()}
      />

      <ScrollView contentContainerClassName="gap-3 px-4 pb-8">
        {loading ? (
          <View className="items-center py-16">
            <ActivityIndicator color={FIELD_ORANGE} />
          </View>
        ) : error ? (
          <View className="rounded-lg bg-primary-50 px-4 py-3">
            <Text className="font-sans text-sm text-primary">{error}</Text>
          </View>
        ) : players.length === 0 ? (
          <Text className="py-16 text-center font-sans text-sm text-on-surface-variant">
            Every player at your center is already registered.
          </Text>
        ) : (
          players.map((player) => (
            <Pressable
              key={player.userId}
              onPress={() => selectPlayer(player)}
              className="flex-row items-center gap-3 rounded-lg border border-outline-variant bg-surface px-4 py-3 active:opacity-90"
              style={INPUT_SHADOW_STYLE}
            >
              <PlayerAvatarWithStatus
                firstName={player.firstName}
                profilePhotoUrl={player.profilePhotoUrl}
                size="sm"
              />
              <View className="min-w-0 flex-1">
                <Text className="font-sans-bold text-base text-on-surface">
                  {player.firstName} {player.lastName}
                </Text>
                <Text className="font-sans text-sm text-on-surface-variant">{player.mobileNumber}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={FIELD_ORANGE} />
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
