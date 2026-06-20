import type { MatchDetail, ScorecardResponse } from '@acc/types';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TabbedInningsScorecard } from '../../../src/components/TabbedInningsScorecard';
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader';
import { Text } from '../../../src/components/ui/Text';
import { FIELD_ORANGE } from '../../../src/components/ui/fieldStyles';
import { useScorecardResolvers } from '../../../src/hooks/useMatchResolvers';
import { ApiRequestError, getMatch, getScorecard } from '../../../src/lib/api';
import { useLiveScore } from '../../../src/lib/live-socket';
import {
  defaultInningsTabIndex,
  INNINGS_TAB_COUNT,
} from '../../../src/lib/scorecardInningsTabs';

/** Read-only live / completed innings scorecard for all users (spec §28). */
export default function LiveViewScreen(): React.ReactElement {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();

  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [seed, setSeed] = useState<ScorecardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inningsIndex, setInningsIndex] = useState(0);

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
        setInningsIndex(defaultInningsTabIndex(card));
        setError(null);
      } catch (err) {
        if (active) {
          setError(err instanceof ApiRequestError ? err.message : 'Could not load the scorecard.');
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
  const { nameOf, teamNameOf, battingTeamLabel } = useScorecardResolvers(state ?? seed, match);

  useEffect(() => {
    if (!state) {
      return;
    }
    setInningsIndex((prev) => {
      if (prev < 0 || prev >= INNINGS_TAB_COUNT) {
        return defaultInningsTabIndex(state);
      }
      return prev;
    });
  }, [state?.innings.length, state?.version]);

  const isLive = match?.state === 'LIVE' || match?.state === 'RAIN_INTERRUPTED';
  const card = state ?? seed;

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={FIELD_ORANGE} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScreenHeader title="Innings scorecard" compact showProfileMenu={false} />

      <ScrollView contentContainerClassName="gap-4 px-4 pb-8">
        <View className="flex-row items-center justify-between">
          <Text className="flex-1 font-sans-bold text-lg text-on-surface" numberOfLines={2}>
            {match
              ? `${match.homeTeamName ?? 'TBD'} vs ${match.awayTeamName ?? match.externalOpponentName ?? 'TBD'}`
              : 'Match scorecard'}
          </Text>
          {isLive ? (
            <View className="flex-row items-center gap-2">
              <View
                className={`h-2 w-2 rounded-full ${status === 'live' ? 'bg-secondary-900' : 'bg-on-surface-variant'}`}
              />
              <Text className="font-sans-medium text-[10px] uppercase tracking-wider text-on-surface-variant">
                {status === 'live' ? 'Live' : status === 'connecting' ? 'Connecting' : 'Offline'}
              </Text>
            </View>
          ) : null}
        </View>

        {error && !state ? (
          <Text className="font-sans text-sm text-on-surface-variant">{error}</Text>
        ) : null}

        {card ? (
          <TabbedInningsScorecard
            card={card}
            match={match}
            nameOf={nameOf}
            teamNameOf={teamNameOf}
            battingTeamLabel={battingTeamLabel}
            inningsIndex={inningsIndex}
            onInningsIndexChange={setInningsIndex}
            isMatchLive={isLive}
            matchOversPerInnings={match?.oversPerInnings ?? null}
          />
        ) : (
          <Text className="font-sans text-sm text-on-surface-variant">
            Waiting for the innings to start.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
