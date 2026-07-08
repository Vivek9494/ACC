import {
  BallType,
  MatchCardDisplayState,
  type BallType as BallTypeValue,
  filterMyMatchesByBallType,
  filterMyMatchesByTournament,
  myMatchTournamentOptionsForBallType,
  type MyMatchListItem,
} from '@acc/types';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';

import { ApiRequestError, getMyMatches } from '../../lib/api';
import { subscribeMatchDataInvalidation } from '../../lib/match-data-invalidation';
import { FIELD_ORANGE } from '../ui/fieldStyles';
import { Select } from '../ui/Select';
import { Text } from '../ui/Text';
import { MyMatchCard } from './MyMatchCard';
import { MyMatchesBallTypeTabs } from './MyMatchesBallTypeTabs';

/** Shared My Matches list — fixtures where the user is in the posted Playing 11. */
export function MyMatchesScreen(): React.ReactElement {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const loadedRef = useRef(false);
  const requestIdRef = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [ballTypes, setBallTypes] = useState<BallTypeValue[]>([]);
  const [matches, setMatches] = useState<Awaited<ReturnType<typeof getMyMatches>>['matches']>([]);
  const [tournaments, setTournaments] = useState<
    Awaited<ReturnType<typeof getMyMatches>>['tournaments']
  >([]);
  const [activeBallType, setActiveBallType] = useState<BallTypeValue>(BallType.Leather);
  const [tournamentFilter, setTournamentFilter] = useState<string | null>(null);

  const load = useCallback(async (options?: { refresh?: boolean; silent?: boolean }) => {
    const requestId = ++requestIdRef.current;

    if (options?.refresh) {
      setRefreshing(true);
    } else if (!options?.silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await getMyMatches();
      if (requestIdRef.current !== requestId) {
        return;
      }
      setBallTypes(data.ballTypes);
      setMatches(data.matches);
      setTournaments(data.tournaments);
      setActiveBallType((prev) => {
        if (data.ballTypes.includes(prev)) {
          return prev;
        }
        return data.ballTypes[0] ?? BallType.Leather;
      });
    } catch (err) {
      if (requestIdRef.current !== requestId) {
        return;
      }
      setError(err instanceof ApiRequestError ? err.message : 'Could not load your matches.');
    } finally {
      if (requestIdRef.current !== requestId) {
        return;
      }
      setLoading(false);
      setRefreshing(false);
      loadedRef.current = true;
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load({ silent: loadedRef.current });
      return () => {
        setRefreshing(false);
      };
    }, [load]),
  );

  useEffect(() => subscribeMatchDataInvalidation(() => void load({ silent: true })), [load]);

  const showBallTypeTabs = ballTypes.length > 1;

  const tournamentOptions = useMemo(() => {
    const scoped = myMatchTournamentOptionsForBallType(tournaments, activeBallType);
    return [
      { value: 'all', label: 'All Tournaments' },
      ...scoped.map((tournament) => ({ value: tournament.id, label: tournament.name })),
    ];
  }, [tournaments, activeBallType]);

  const visibleMatches = useMemo(() => {
    const byBall = filterMyMatchesByBallType(matches, activeBallType);
    return filterMyMatchesByTournament(byBall, tournamentFilter);
  }, [matches, activeBallType, tournamentFilter]);

  useEffect(() => {
    setTournamentFilter(null);
  }, [activeBallType]);

  function openMatchDetail(matchId: string): void {
    router.push(`/matches/${matchId}`);
  }

  function openMatchLive(matchId: string): void {
    router.push(`/matches/${matchId}/live`);
  }

  function openMatchScorecard(matchId: string): void {
    router.push(`/matches/${matchId}/scorecard`);
  }

  function openMatch(match: MyMatchListItem): void {
    if (match.displayState === MatchCardDisplayState.Live) {
      openMatchLive(match.id);
      return;
    }
    if (
      match.displayState === MatchCardDisplayState.Completed ||
      match.displayState === MatchCardDisplayState.Cancelled
    ) {
      openMatchScorecard(match.id);
      return;
    }
    openMatchDetail(match.id);
  }

  if (loading && !loaded) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={FIELD_ORANGE} />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="gap-4 px-4 pb-8 pt-4"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void load({ refresh: true })}
          tintColor={FIELD_ORANGE}
        />
      }
    >
      <Text className="font-sans-bold text-2xl text-on-surface">My Matches</Text>

      {error ? (
        <View className="rounded-lg bg-primary-50 px-4 py-3">
          <Text className="font-sans text-sm text-primary">{error}</Text>
        </View>
      ) : null}

      {showBallTypeTabs ? (
        <MyMatchesBallTypeTabs
          ballTypes={ballTypes}
          selected={activeBallType}
          onSelect={setActiveBallType}
        />
      ) : null}

      {matches.length > 0 ? (
        <Select
          label="Filter by Tournament"
          labelVariant="brand"
          placeholder="All Tournaments"
          value={tournamentFilter ?? 'all'}
          options={tournamentOptions}
          onChange={(value) => setTournamentFilter(value === 'all' ? null : value)}
        />
      ) : null}

      {matches.length === 0 ? (
        <View className="items-center rounded-control border border-outline-variant bg-surface-container-lowest px-6 py-12">
          <Text className="font-sans-semibold text-base text-on-surface">No matches yet</Text>
          <Text className="mt-2 text-center font-sans text-sm text-on-surface-variant">
            Matches where you are named in the posted Playing 11 will appear here once the lineup
            is locked.
          </Text>
        </View>
      ) : visibleMatches.length === 0 ? (
        <View className="items-center rounded-control border border-outline-variant bg-surface-container-lowest px-6 py-12">
          <Text className="font-sans-semibold text-base text-on-surface">No matches in this filter</Text>
          <Text className="mt-2 text-center font-sans text-sm text-on-surface-variant">
            Try another tournament or ball type.
          </Text>
        </View>
      ) : (
        <View className="gap-4">
          {visibleMatches.map((match) => (
            <MyMatchCard
              key={match.id}
              match={match}
              onPress={() => openMatch(match)}
              onWatchLivePress={() => openMatchLive(match.id)}
              onScorecardPress={() => openMatchScorecard(match.id)}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}
