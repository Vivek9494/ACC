import type { MatchDetail, ScorecardResponse } from '@acc/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Text } from '../../../src/components/ui/Text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LiveScorecard, type NameResolver } from '../../../src/components/LiveScorecard';
import { ApiRequestError, getMatch, getScorecard } from '../../../src/lib/api';
import { useLiveScore } from '../../../src/lib/live-socket';

/** Builds id→name and teamId→name resolvers from the match squads. */
function useResolvers(match: MatchDetail | null): { nameOf: NameResolver; teamNameOf: NameResolver } {
  return useMemo(() => {
    const players = new Map<string, string>();
    const teams = new Map<string, string>();
    if (match) {
      for (const squad of match.squads) {
        teams.set(squad.teamId, squad.teamName);
        for (const p of squad.players) {
          players.set(p.userId, `${p.firstName} ${p.lastName}`);
        }
      }
      if (match.homeTeamId) teams.set(match.homeTeamId, match.homeTeamName ?? 'Home');
      if (match.awayTeamId) teams.set(match.awayTeamId, match.awayTeamName ?? 'Away');
    }
    const nameOf: NameResolver = (id) => (id ? (players.get(id) ?? 'Player') : '—');
    const teamNameOf: NameResolver = (id) =>
      id ? (teams.get(id) ?? match?.externalOpponentName ?? 'Team') : 'Team';
    return { nameOf, teamNameOf };
  }, [match]);
}

/** Read-only live match view for players and guests (spec §28, §2). */
export default function LiveViewScreen(): React.ReactElement {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();

  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [seed, setSeed] = useState<ScorecardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!matchId) return;
      try {
        const [m, card] = await Promise.all([
          getMatch(matchId).catch(() => null),
          getScorecard(matchId),
        ]);
        if (!active) return;
        setMatch(m);
        setSeed(card);
      } catch (err) {
        if (active) {
          setError(err instanceof ApiRequestError ? err.message : 'Could not load the live score.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [matchId]);

  const { state, status } = useLiveScore(matchId, seed);
  const { nameOf, teamNameOf } = useResolvers(match);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator color="#a04100" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView contentContainerClassName="px-6 py-6 gap-4">
        <View className="flex-row items-center justify-between">
          <Pressable onPress={() => router.back()}>
            <Text className="font-sans text-primary">← Back</Text>
          </Pressable>
          <View className="flex-row items-center gap-2">
            <View
              className={`h-2 w-2 rounded-full ${status === 'live' ? 'bg-[#16a34a]' : 'bg-on-surface-variant'}`}
            />
            <Text className="font-sans-medium text-[11px] uppercase tracking-wider text-on-surface-variant">
              {status === 'live' ? 'Live' : status === 'connecting' ? 'Connecting' : 'Offline'}
            </Text>
          </View>
        </View>

        <Text className="font-sans-bold text-2xl text-on-surface">
          {match
            ? `${match.homeTeamName ?? 'TBD'} vs ${match.awayTeamName ?? match.externalOpponentName ?? 'TBD'}`
            : 'Live Match'}
        </Text>

        {error && !state ? (
          <Text className="font-sans text-sm text-on-surface-variant">{error}</Text>
        ) : null}

        {state ? (
          <LiveScorecard state={state} nameOf={nameOf} teamNameOf={teamNameOf} />
        ) : (
          <Text className="font-sans text-sm text-on-surface-variant">
            Waiting for the match to go live.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
