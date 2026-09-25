import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import {
  BallType,
  CitySelection,
  canViewRegisteredPlayersStatusTabs,
  isRegisteredPlayersConfirmedOnlyViewer,
  compareVerifiedPlayersForSkillFilter,
  matchesVerifiedPlayerSkillFilter,
  VERIFIED_PLAYER_SKILL_FILTER_LABELS,
  VERIFIED_PLAYER_SKILL_FILTER_ORDER,
  type RegistrationSummary,
  type TournamentScopeDisplay,
  type VerifiedPlayerSkillFilter,
  type VerifiedRegisteredPlayerRow,
} from '@acc/types';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LeatherRegisteredPlayerListCard } from '../../../../src/components/tournament/LeatherRegisteredPlayerListCard';
import { RegisteredPlayerListCard } from '../../../../src/components/tournament/RegisteredPlayerListCard';
import { RegisteredPlayerRegistrationDetailsModal } from '../../../../src/components/tournament/RegisteredPlayerRegistrationDetailsModal';
import { SkillVideoPlayerModal } from '../../../../src/components/tournament/SkillVideoPlayerModal';
import { Button } from '../../../../src/components/ui/Button';
import { ScreenHeader } from '../../../../src/components/ui/ScreenHeader';
import { KeyboardAwareFormScrollView } from '../../../../src/components/ui/KeyboardAwareFormScrollView';
import {
  PillTabBar,
} from '../../../../src/components/ui/PillTabBar';
import { Select, type SelectOption } from '../../../../src/components/ui/Select';
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

type TennisStatusTab = 'waitlist' | 'confirmed' | 'declined';

const ALL_CENTER_VALUE = '__all__';

const TENNIS_STATUS_TABS: readonly {
  value: TennisStatusTab;
  label: string;
}[] = [
  { value: 'waitlist', label: 'In Waitlist' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'declined', label: 'Declined' },
];

interface PlayerListFilters {
  search: string;
  centerId: string | null;
}

const EMPTY_FILTERS: PlayerListFilters = {
  search: '',
  centerId: null,
};

function filterHasValues(filters: PlayerListFilters): boolean {
  return filters.search.trim().length > 0 || filters.centerId != null;
}

/** APL / multi-center tennis — show participating centers in the filter panel. */
function shouldShowCenterFilter(
  isLeather: boolean,
  scope: TournamentScopeDisplay | null,
): boolean {
  if (isLeather || !scope) {
    return false;
  }
  return (
    scope.citySelection === CitySelection.Apl ||
    scope.citySelection === CitySelection.Multi
  );
}

function matchesPlayerSearch(
  firstName: string,
  lastName: string,
  centerName: string,
  query: string,
): boolean {
  if (!query) {
    return true;
  }
  const name = `${firstName} ${lastName}`.toLowerCase();
  const center = centerName.toLowerCase();
  return name.includes(query) || center.includes(query);
}

/** Registered players — tennis (post-open) or leather (ACC squad-building). */
export default function VerifiedRegisteredPlayersScreen(): React.ReactElement {
  const router = useRouter();
  const { user } = useAuth();
  const { id: tournamentId } = useLocalSearchParams<{ id: string }>();
  const [isLeather, setIsLeather] = useState(false);
  const [scopeDisplay, setScopeDisplay] = useState<TournamentScopeDisplay | null>(null);
  const [waitlist, setWaitlist] = useState<VerifiedRegisteredPlayerRow[]>([]);
  const [confirmed, setConfirmed] = useState<VerifiedRegisteredPlayerRow[]>([]);
  const [declined, setDeclined] = useState<VerifiedRegisteredPlayerRow[]>([]);
  const [leatherPlayers, setLeatherPlayers] = useState<RegistrationSummary[]>([]);
  const [registeredCount, setRegisteredCount] = useState(0);
  const [statusTab, setStatusTab] = useState<TennisStatusTab>(() =>
    canViewRegisteredPlayersStatusTabs(user) ? 'waitlist' : 'confirmed',
  );
  const [canFavourite, setCanFavourite] = useState(false);
  const [canLateRegister, setCanLateRegister] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<PlayerListFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<PlayerListFilters>(EMPTY_FILTERS);
  const [skillFilter, setSkillFilter] = useState<VerifiedPlayerSkillFilter>(
    VERIFIED_PLAYER_SKILL_FILTER_ORDER[0],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingFavouriteUserId, setPendingFavouriteUserId] = useState<string | null>(null);
  const [detailsPlayer, setDetailsPlayer] = useState<RegistrationSummary | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const skillVideo = useSkillVideoPlayback(tournamentId);

  const showStatusTabs =
    canViewRegisteredPlayersStatusTabs(user) &&
    (tournamentId == null ||
      !isRegisteredPlayersConfirmedOnlyViewer(user, tournamentId));
  const showCenterFilter = shouldShowCenterFilter(isLeather, scopeDisplay);
  const hasAppliedFilters = filterHasValues(appliedFilters);

  const centerOptions = useMemo<SelectOption[]>(() => {
    if (!scopeDisplay) {
      return [{ value: ALL_CENTER_VALUE, label: 'All centers' }];
    }
    const centerIds = scopeDisplay.centerIds ?? [];
    const centerNames = scopeDisplay.centerNames ?? [];
    const options: SelectOption[] = [{ value: ALL_CENTER_VALUE, label: 'All centers' }];
    const count = Math.min(centerIds.length, centerNames.length);
    for (let i = 0; i < count; i += 1) {
      const id = centerIds[i];
      const name = centerNames[i];
      if (id && name) {
        options.push({ value: id, label: name });
      }
    }
    return options;
  }, [scopeDisplay]);

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
      setScopeDisplay(tournament.scopeDisplay);

      if (leather) {
        const data = await listLeatherRegisteredPlayers(tournamentId);
        setLeatherPlayers(data.players);
        setRegisteredCount(data.totalCount);
        setWaitlist([]);
        setConfirmed([]);
        setDeclined([]);
        setCanFavourite(false);
        setCanLateRegister(data.canLateRegister);
      } else {
        const data = await listVerifiedRegisteredPlayers(tournamentId);
        setWaitlist(data.waitlist);
        setConfirmed(data.confirmed);
        setDeclined(data.declined);
        setLeatherPlayers([]);
        setRegisteredCount(
          data.waitlist.length + data.confirmed.length + data.declined.length,
        );
        setCanFavourite(data.canFavourite);
        setCanLateRegister(data.canLateRegister);
      }
      setError(null);
    } catch (err) {
      setWaitlist([]);
      setConfirmed([]);
      setDeclined([]);
      setLeatherPlayers([]);
      setRegisteredCount(0);
      setCanFavourite(false);
      setCanLateRegister(false);
      setScopeDisplay(null);
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

  const tennisTabOptions = useMemo(
    () =>
      TENNIS_STATUS_TABS.map((tab) => {
        const count =
          tab.value === 'waitlist'
            ? waitlist.length
            : tab.value === 'confirmed'
              ? confirmed.length
              : declined.length;
        return {
          value: tab.value,
          label: `${tab.label} (${count})`,
        };
      }),
    [waitlist.length, confirmed.length, declined.length],
  );

  const activeTennisPlayers = useMemo(() => {
    if (!showStatusTabs || statusTab === 'confirmed') {
      return confirmed;
    }
    if (statusTab === 'waitlist') {
      return waitlist;
    }
    if (statusTab === 'declined') {
      return declined;
    }
    return confirmed;
  }, [showStatusTabs, statusTab, waitlist, confirmed, declined]);

  const filteredTennis = useMemo(() => {
    const q = appliedFilters.search.trim().toLowerCase();
    const centerId = appliedFilters.centerId;
    const applySkill = !showStatusTabs || statusTab === 'confirmed';
    let rows = applySkill
      ? activeTennisPlayers.filter((player) =>
          matchesVerifiedPlayerSkillFilter(player, skillFilter),
        )
      : activeTennisPlayers;

    if (centerId) {
      rows = rows.filter((player) => player.centerId === centerId);
    }

    if (q) {
      rows = rows.filter((player) =>
        matchesPlayerSearch(player.firstName, player.lastName, player.centerName, q),
      );
    }

    if (applySkill) {
      return [...rows].sort((a, b) => compareVerifiedPlayersForSkillFilter(a, b, skillFilter));
    }
    return rows;
  }, [activeTennisPlayers, appliedFilters, skillFilter, showStatusTabs, statusTab]);

  const filteredLeather = useMemo(() => {
    const q = appliedFilters.search.trim().toLowerCase();
    if (!q) {
      return leatherPlayers;
    }
    return leatherPlayers.filter((player) =>
      matchesPlayerSearch(player.firstName, player.lastName, player.centerName, q),
    );
  }, [appliedFilters.search, leatherPlayers]);

  function toggleFiltersPanel(): void {
    setFiltersOpen((open) => {
      const next = !open;
      if (next) {
        setDraftFilters(appliedFilters);
      }
      return next;
    });
  }

  function applyFilters(): void {
    setAppliedFilters({
      search: draftFilters.search,
      centerId: showCenterFilter ? draftFilters.centerId : null,
    });
    setFiltersOpen(false);
  }

  function clearFilters(): void {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
  }

  async function toggleFavourite(player: VerifiedRegisteredPlayerRow): Promise<void> {
    if (!tournamentId || !canFavourite || (showStatusTabs && statusTab !== 'confirmed')) {
      return;
    }
    const next = !player.isFavourited;
    setPendingFavouriteUserId(player.userId);
    setConfirmed((current) =>
      current.map((row) =>
        row.userId === player.userId ? { ...row, isFavourited: next } : row,
      ),
    );
    try {
      await setRegistrationFavourite(tournamentId, player.userId, next);
    } catch (err) {
      setConfirmed((current) =>
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

  const emptyMessage =
    hasAppliedFilters
      ? 'No players match your search or filters.'
      : isLeather
        ? 'No registered players yet.'
        : statusTab === 'waitlist'
          ? 'No players in the waitlist.'
          : statusTab === 'declined'
            ? 'No declined players.'
            : 'No confirmed players.';

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      <ScreenHeader
        title={
          loading ? 'Registered Players' : `Registered Players (${registeredCount})`
        }
        onBack={() => router.back()}
        titleTrailing={
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={toggleFiltersPanel}
              accessibilityRole="button"
              accessibilityLabel={
                filtersOpen ? 'Hide player filters' : 'Show player filters'
              }
              accessibilityState={{ expanded: filtersOpen }}
              hitSlop={8}
              className="h-9 w-9 items-center justify-center active:opacity-70"
            >
              <MaterialIcons
                name="filter-list"
                size={24}
                color={hasAppliedFilters || filtersOpen ? FIELD_ORANGE : '#5A4136'}
              />
            </Pressable>
            {canLateRegister ? (
              <Pressable
                onPress={openLateRegister}
                accessibilityRole="button"
                accessibilityLabel="Add player"
                className="h-9 w-9 items-center justify-center rounded-full bg-primary active:opacity-90"
              >
                <Ionicons name="add" size={22} color={colors.textInverse} />
              </Pressable>
            ) : null}
          </View>
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
          {filtersOpen ? (
            <View className="gap-3 rounded-control border border-outline-variant bg-surface-container-lowest p-3">
              <TextInput
                placeholder="Search by name or center…"
                value={draftFilters.search}
                onChangeText={(text) =>
                  setDraftFilters((current) => ({ ...current, search: text }))
                }
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                containerClassName="mb-0"
              />
              {showCenterFilter ? (
                <Select
                  placeholder="All centers"
                  value={draftFilters.centerId ?? ALL_CENTER_VALUE}
                  options={centerOptions}
                  onChange={(value) =>
                    setDraftFilters((current) => ({
                      ...current,
                      centerId: value === ALL_CENTER_VALUE ? null : value,
                    }))
                  }
                  emptyMessage="No centers for this tournament"
                  containerClassName="mb-0"
                />
              ) : null}
              <View className="flex-row gap-3">
                <View className="min-w-0 flex-1">
                  <Button
                    label="Clear"
                    variant="outline"
                    onPress={clearFilters}
                    className="h-11"
                  />
                </View>
                <View className="min-w-0 flex-1">
                  <Button label="Apply" onPress={applyFilters} className="h-11" />
                </View>
              </View>
            </View>
          ) : null}

          {!isLeather ? (
            <View className="gap-1">
              {showStatusTabs ? (
                <PillTabBar
                  options={tennisTabOptions}
                  value={statusTab}
                  onChange={setStatusTab}
                  layout="scroll"
                  accessibilityLabel="Registration status"
                />
              ) : null}
              {!showStatusTabs || statusTab === 'confirmed' ? (
                <PillTabBar
                  options={VERIFIED_PLAYER_SKILL_FILTER_ORDER.map((key) => ({
                    value: key,
                    label: VERIFIED_PLAYER_SKILL_FILTER_LABELS[key],
                  }))}
                  value={skillFilter}
                  onChange={setSkillFilter}
                  layout="scroll"
                  accessibilityLabel="Player type"
                />
              ) : null}
            </View>
          ) : null}
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
                  canFavourite && statusTab === 'confirmed'
                    ? () => void toggleFavourite(player)
                    : undefined
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
