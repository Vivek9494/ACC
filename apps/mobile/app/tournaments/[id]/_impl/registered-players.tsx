import { Ionicons } from '@expo/vector-icons';
import {
  BallType,
  compareVerifiedPlayersForSkillFilter,
  matchesVerifiedPlayerSkillFilter,
  VERIFIED_PLAYER_SKILL_FILTER_LABELS,
  VERIFIED_PLAYER_SKILL_FILTER_ORDER,
  type RegistrationSummary,
  type VerifiedPlayerSkillFilter,
  type VerifiedRegisteredPlayerRow,
} from '@acc/types';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LeatherRegisteredPlayerListCard } from '../../../../src/components/tournament/LeatherRegisteredPlayerListCard';
import { RegisteredPlayerListCard } from '../../../../src/components/tournament/RegisteredPlayerListCard';
import { RegisteredPlayerRegistrationDetailsModal } from '../../../../src/components/tournament/RegisteredPlayerRegistrationDetailsModal';
import { SkillVideoPlayerModal } from '../../../../src/components/tournament/SkillVideoPlayerModal';
import { ScreenHeader } from '../../../../src/components/ui/ScreenHeader';
import { KeyboardAwareFormScrollView } from '../../../../src/components/ui/KeyboardAwareFormScrollView';
import { TextInput } from '../../../../src/components/ui/TextInput';
import { Text } from '../../../../src/components/ui/Text';
import { FIELD_ORANGE } from '../../../../src/components/ui/fieldStyles';
import { colors } from '../../../../src/theme/colors';
import { useSkillVideoPlayback } from '../../../../src/hooks/useSkillVideoPlayback';
import {
  ApiRequestError,
  getTournament,
  listLeatherRegisteredPlayers,
  listVerifiedRegisteredPlayers,
  setRegistrationFavourite,
} from '../../../../src/lib/api';
import { useAuth } from '../../../../src/lib/auth-context';
import { tournamentSubpathHref } from '../../../../src/lib/tournament-detail-route';

/** Registered players — tennis (post-verification) or leather (ACC squad-building). */
export default function VerifiedRegisteredPlayersScreen(): React.ReactElement {
  const router = useRouter();
  const { user } = useAuth();
  const { id: tournamentId } = useLocalSearchParams<{ id: string }>();
  const [isLeather, setIsLeather] = useState(false);
  const [players, setPlayers] = useState<VerifiedRegisteredPlayerRow[]>([]);
  const [leatherPlayers, setLeatherPlayers] = useState<RegistrationSummary[]>([]);
  const [registeredCount, setRegisteredCount] = useState(0);
  const [canFavourite, setCanFavourite] = useState(false);
  const [canLateRegister, setCanLateRegister] = useState(false);
  const [search, setSearch] = useState('');
  const [skillFilter, setSkillFilter] = useState<VerifiedPlayerSkillFilter>(
    VERIFIED_PLAYER_SKILL_FILTER_ORDER[0],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingFavouriteUserId, setPendingFavouriteUserId] = useState<string | null>(null);
  const [detailsPlayer, setDetailsPlayer] = useState<RegistrationSummary | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const skillVideo = useSkillVideoPlayback(tournamentId);

  const load = useCallback(async () => {
    if (!tournamentId) {
      setError('Tournament not found.');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const tournament = await getTournament(tournamentId);
      const leather = tournament.ballType === BallType.Leather;
      setIsLeather(leather);

      if (leather) {
        const data = await listLeatherRegisteredPlayers(tournamentId);
        setLeatherPlayers(data.players);
        setRegisteredCount(data.totalCount);
        setPlayers([]);
        setCanFavourite(false);
        setCanLateRegister(data.canLateRegister);
      } else {
        const data = await listVerifiedRegisteredPlayers(tournamentId);
        setPlayers(data.players);
        setLeatherPlayers([]);
        setRegisteredCount(data.players.length);
        setCanFavourite(data.canFavourite);
        setCanLateRegister(data.canLateRegister);
      }
      setError(null);
    } catch (err) {
      setPlayers([]);
      setLeatherPlayers([]);
      setRegisteredCount(0);
      setCanFavourite(false);
      setCanLateRegister(false);
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

  const filteredTennis = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = players.filter((player) => matchesVerifiedPlayerSkillFilter(player, skillFilter));

    if (q) {
      rows = rows.filter((player) => {
        const name = `${player.firstName} ${player.lastName}`.toLowerCase();
        const center = player.centerName.toLowerCase();
        return name.includes(q) || center.includes(q);
      });
    }

    return [...rows].sort((a, b) => compareVerifiedPlayersForSkillFilter(a, b, skillFilter));
  }, [players, search, skillFilter]);

  const filteredLeather = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return leatherPlayers;
    }
    return leatherPlayers.filter((player) => {
      const name = `${player.firstName} ${player.lastName}`.toLowerCase();
      const center = player.centerName.toLowerCase();
      return name.includes(q) || center.includes(q);
    });
  }, [leatherPlayers, search]);

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
      Alert.alert(
        'Could not update favourite',
        err instanceof ApiRequestError ? err.message : 'Please try again.',
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
      tournamentSubpathHref(user, tournamentId, 'players/[userId]', {
        userId: player.userId,
        firstName: player.firstName,
        lastName: player.lastName,
      }),
    );
  }

  function openRegistrationDetails(player: RegistrationSummary): void {
    setDetailsPlayer(player);
    setDetailsVisible(true);
  }

  function closeRegistrationDetails(): void {
    setDetailsVisible(false);
    setDetailsPlayer(null);
  }

  function openLateRegister(): void {
    if (!tournamentId) {
      return;
    }
    router.push(tournamentSubpathHref(user, tournamentId, 'registrations/late-register'));
  }

  const screenTitle = isLeather ? 'Registered Players' : 'Registered Players';
  const emptyMessage = isLeather
    ? 'No registered players match your search.'
    : 'No verified players match your search.';

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      <ScreenHeader
        title={screenTitle}
        onBack={() => router.back()}
        titleTrailing={
          canLateRegister ? (
            <Pressable
              onPress={openLateRegister}
              accessibilityRole="button"
              accessibilityLabel="Add player"
              className="h-9 w-9 items-center justify-center rounded-full bg-primary active:opacity-90"
            >
              <Ionicons name="add" size={22} color={colors.textInverse} />
            </Pressable>
          ) : null
        }
      />

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
        <KeyboardAwareFormScrollView className="flex-1" contentContainerClassName="gap-4 px-4" extraBottomPadding={40}>
          <Text className="font-sans-semibold text-sm text-on-surface-variant">
            {registeredCount} Registered
          </Text>
          <View className="gap-6">
            <TextInput
              placeholder="Search by name or center…"
              value={search}
              onChangeText={setSearch}
            />
            {!isLeather ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
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
            ) : null}
          </View>
          <View className="mt-2 gap-4">
          {isLeather ? (
            filteredLeather.length === 0 ? (
              <Text className="py-16 text-center font-sans text-base text-on-surface-variant">
                {emptyMessage}
              </Text>
            ) : (
              filteredLeather.map((player) => (
                <LeatherRegisteredPlayerListCard
                  key={player.id}
                  player={player}
                  onPress={() => openRegistrationDetails(player)}
                />
              ))
            )
          ) : filteredTennis.length === 0 ? (
            <Text className="py-16 text-center font-sans text-base text-on-surface-variant">
              {emptyMessage}
            </Text>
          ) : (
            filteredTennis.map((player) => (
              <RegisteredPlayerListCard
                key={player.id}
                player={player}
                onPress={() => openRegistrationDetails(player)}
                favouritePending={pendingFavouriteUserId === player.userId}
                onToggleFavourite={
                  canFavourite ? () => void toggleFavourite(player) : undefined
                }
                onViewProfile={() => openProfile(player)}
                onViewVideo={() => skillVideo.openVideo(player)}
              />
            ))
          )}
          </View>
        </KeyboardAwareFormScrollView>
      ) : null}

      {!isLeather ? (
        <SkillVideoPlayerModal
          visible={skillVideo.visible}
          playerName={skillVideo.playerName}
          playback={skillVideo.playback}
          loading={skillVideo.loading}
          error={skillVideo.error}
          onRetry={skillVideo.retry}
          onClose={skillVideo.closeVideo}
        />
      ) : null}

      <RegisteredPlayerRegistrationDetailsModal
        visible={detailsVisible}
        player={detailsPlayer}
        onClose={closeRegistrationDetails}
      />
    </SafeAreaView>
  );
}
