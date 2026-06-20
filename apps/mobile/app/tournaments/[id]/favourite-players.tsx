import type { VerifiedRegisteredPlayerRow } from '@acc/types';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RegisteredPlayerListCard } from '../../../src/components/tournament/RegisteredPlayerListCard';
import { SkillVideoPlayerModal } from '../../../src/components/tournament/SkillVideoPlayerModal';
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader';
import { Text } from '../../../src/components/ui/Text';
import { FIELD_ORANGE } from '../../../src/components/ui/fieldStyles';
import { useSkillVideoPlayback } from '../../../src/hooks/useSkillVideoPlayback';
import {
  ApiRequestError,
  getTournamentFavouritePlayers,
  setRegistrationFavourite,
} from '../../../src/lib/api';

/** Per-team shared favourites — Captain / Vice-Captain (same list as Registered Players hearts). */
export default function FavouritePlayersScreen(): React.ReactElement {
  const router = useRouter();
  const { id: tournamentId } = useLocalSearchParams<{ id: string }>();
  const [favourites, setFavourites] = useState<VerifiedRegisteredPlayerRow[]>([]);
  const [canFavourite, setCanFavourite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingFavouriteUserId, setPendingFavouriteUserId] = useState<string | null>(null);
  const skillVideo = useSkillVideoPlayback(tournamentId);

  const load = useCallback(async () => {
    if (!tournamentId) {
      setError('Tournament not found.');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await getTournamentFavouritePlayers(tournamentId);
      setFavourites(
        data.favourites.map((player) => ({ ...player, isFavourited: true })),
      );
      setCanFavourite(data.canFavourite);
      setError(null);
    } catch (err) {
      setFavourites([]);
      setCanFavourite(false);
      setError(
        err instanceof ApiRequestError
          ? err.message
          : 'You do not have permission to view favourite players.',
      );
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function unfavourite(player: VerifiedRegisteredPlayerRow): Promise<void> {
    if (!tournamentId || !canFavourite) {
      return;
    }
    setPendingFavouriteUserId(player.userId);
    setFavourites((current) => current.filter((row) => row.userId !== player.userId));
    try {
      await setRegistrationFavourite(tournamentId, player.userId, false);
    } catch (err) {
      setFavourites((current) => {
        if (current.some((row) => row.userId === player.userId)) {
          return current;
        }
        return [...current, player].sort((a, b) =>
          `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`),
        );
      });
      setError(
        err instanceof ApiRequestError ? err.message : 'Could not remove favourite.',
      );
    } finally {
      setPendingFavouriteUserId(null);
    }
  }

  function openProfile(player: VerifiedRegisteredPlayerRow): void {
    if (!tournamentId) {
      return;
    }
    router.push(
      `/tournaments/${tournamentId}/players/${player.userId}?firstName=${encodeURIComponent(player.firstName)}&lastName=${encodeURIComponent(player.lastName)}` as Href,
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      <ScreenHeader title="Favourite Players" onBack={() => router.back()} showProfileMenu={false} />

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

      {!loading && !error ? (
        <ScrollView className="flex-1 px-4" contentContainerClassName="gap-4 pb-10 pt-2">
          {favourites.length === 0 ? (
            <View className="items-center gap-2 px-4 py-16">
              <Text className="text-center font-sans-semibold text-base text-on-surface">
                No favourite players yet
              </Text>
              <Text className="text-center font-sans text-sm text-on-surface-variant">
                Add players from the Registered Players List by tapping the heart on their card.
              </Text>
            </View>
          ) : (
            favourites.map((player) => (
              <RegisteredPlayerListCard
                key={player.id}
                player={player}
                favouritePending={pendingFavouriteUserId === player.userId}
                onToggleFavourite={
                  canFavourite ? () => void unfavourite(player) : undefined
                }
                onViewProfile={() => openProfile(player)}
                onViewVideo={() => skillVideo.openVideo(player)}
              />
            ))
          )}
        </ScrollView>
      ) : null}

      <SkillVideoPlayerModal
        visible={skillVideo.visible}
        playerName={skillVideo.playerName}
        playback={skillVideo.playback}
        loading={skillVideo.loading}
        error={skillVideo.error}
        onRetry={skillVideo.retry}
        onClose={skillVideo.closeVideo}
      />
    </SafeAreaView>
  );
}
