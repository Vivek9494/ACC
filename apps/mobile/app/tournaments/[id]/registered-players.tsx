import { colors } from '@/theme/colors';
import {
  matchesVerifiedPlayerSkillFilter,
  VERIFIED_PLAYER_SKILL_FILTER_LABELS,
  VERIFIED_PLAYER_SKILL_FILTER_ORDER,
  type VerifiedPlayerSkillFilter,
  type VerifiedRegisteredPlayerRow,
} from '@acc/types';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RegisteredPlayerListCard } from '../../../src/components/tournament/RegisteredPlayerListCard';
import { SkillVideoPlayerModal } from '../../../src/components/tournament/SkillVideoPlayerModal';
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader';
import { Text } from '../../../src/components/ui/Text';
import { FIELD_ORANGE } from '../../../src/components/ui/fieldStyles';
import { useSkillVideoPlayback } from '../../../src/hooks/useSkillVideoPlayback';
import {
  ApiRequestError,
  listVerifiedRegisteredPlayers,
  setRegistrationFavourite,
} from '../../../src/lib/api';

/** Verified registrants for Captain / VC / Club Manager (tennis, post-verification). */
export default function VerifiedRegisteredPlayersScreen(): React.ReactElement {
  const router = useRouter();
  const { id: tournamentId } = useLocalSearchParams<{ id: string }>();
  const [players, setPlayers] = useState<VerifiedRegisteredPlayerRow[]>([]);
  const [canFavourite, setCanFavourite] = useState(false);
  const [search, setSearch] = useState('');
  const [skillFilter, setSkillFilter] = useState<VerifiedPlayerSkillFilter>(
    VERIFIED_PLAYER_SKILL_FILTER_ORDER[0],
  );
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
      const data = await listVerifiedRegisteredPlayers(tournamentId);
      setPlayers(data.players);
      setCanFavourite(data.canFavourite);
      setError(null);
    } catch (err) {
      setPlayers([]);
      setCanFavourite(false);
      setError(
        err instanceof ApiRequestError
          ? err.message
          : 'You do not have permission to view registered players.',
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = players.filter((player) => matchesVerifiedPlayerSkillFilter(player, skillFilter));

    if (!q) {
      return rows;
    }

    return rows.filter((player) => {
      const name = `${player.firstName} ${player.lastName}`.toLowerCase();
      const center = player.centerName.toLowerCase();
      return name.includes(q) || center.includes(q);
    });
  }, [players, search, skillFilter]);

  async function toggleFavourite(player: VerifiedRegisteredPlayerRow): Promise<void> {
    if (!tournamentId || !canFavourite) {
      return;
    }
    const next = !player.isFavourited;
    setPendingFavouriteUserId(player.userId);
    setPlayers((current) =>
      current.map((row) =>
        row.userId === player.userId ? { ...row, isFavourited: next } : row,
      ),
    );
    try {
      await setRegistrationFavourite(tournamentId, player.userId, next);
    } catch (err) {
      setPlayers((current) =>
        current.map((row) =>
          row.userId === player.userId ? { ...row, isFavourited: player.isFavourited } : row,
        ),
      );
      setError(
        err instanceof ApiRequestError ? err.message : 'Could not update favourite.',
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
      <ScreenHeader
        title="Registered Players"
        onBack={() => router.back()}
        showProfileMenu={false}
      />

      <View className="px-4 pb-3">
        <TextInput
          className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-3 font-sans text-base text-on-surface"
          placeholder="Search by name or center…"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-3"
          contentContainerClassName="gap-2 pr-2"
        >
          {VERIFIED_PLAYER_SKILL_FILTER_ORDER.map((key) => {
            const active = key === skillFilter;
            return (
              <Pressable
                key={key}
                onPress={() => setSkillFilter(key)}
                className={`rounded-full px-4 py-2 ${active ? 'bg-secondary-container' : 'border border-outline-variant bg-surface-container-lowest'}`}
              >
                <Text
                  className={`font-sans-semibold text-sm ${active ? 'text-on-secondary-container' : 'text-on-surface-variant'}`}
                >
                  {VERIFIED_PLAYER_SKILL_FILTER_LABELS[key]}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

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
        <ScrollView className="flex-1 px-4" contentContainerClassName="gap-4 pb-10">
          {filtered.length === 0 ? (
            <Text className="py-16 text-center font-sans text-base text-on-surface-variant">
              No verified players match your search.
            </Text>
          ) : (
            filtered.map((player) => (
              <RegisteredPlayerListCard
                key={player.id}
                player={player}
                favouritePending={pendingFavouriteUserId === player.userId}
                onToggleFavourite={
                  canFavourite ? () => void toggleFavourite(player) : undefined
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
