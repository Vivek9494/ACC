import type { TournamentPlayerProfileView } from '@acc/types';
import { formatPlayerProfileDisplayName } from '@acc/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlayerProfileContent } from '../../../../src/components/tournament/player-profile/PlayerProfileContent';
import { ScreenHeader } from '../../../../src/components/ui/ScreenHeader';
import { Text } from '../../../../src/components/ui/Text';
import { FIELD_ORANGE } from '../../../../src/components/ui/fieldStyles';
import { ApiRequestError, getTournamentPlayerProfile } from '../../../../src/lib/api';

/** Tournament-scoped player profile — captains and Club Managers only (server-enforced). */
export default function TournamentPlayerProfileScreen(): React.ReactElement {
  const router = useRouter();
  const { id: tournamentId, userId } = useLocalSearchParams<{ id: string; userId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<TournamentPlayerProfileView | null>(null);

  useEffect(() => {
    if (!tournamentId || !userId) {
      setError('Player not found.');
      setLoading(false);
      return;
    }

    setLoading(true);
    void getTournamentPlayerProfile(tournamentId, userId)
      .then((data) => {
        setProfile(data);
        setError(null);
      })
      .catch((err: unknown) => {
        setProfile(null);
        setError(
          err instanceof ApiRequestError
            ? err.message
            : 'You do not have permission to view this profile.',
        );
      })
      .finally(() => setLoading(false));
  }, [tournamentId, userId]);

  const title = profile
    ? formatPlayerProfileDisplayName(profile.firstName, profile.lastName)
    : 'Player';

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      <ScreenHeader title={title} onBack={() => router.back()} showProfileMenu={false} />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={FIELD_ORANGE} />
        </View>
      ) : null}

      {!loading && error ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center font-sans text-base text-primary">{error}</Text>
        </View>
      ) : null}

      {!loading && profile ? <PlayerProfileContent profile={profile} /> : null}
    </SafeAreaView>
  );
}
