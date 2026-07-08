import { BallType, type OwnPlayerStatsView } from '@acc/types';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiRequestError, getOwnPlayerStats } from '../../lib/api';
import { PlayerMomStatsCard } from '../stats/PlayerMomStatsCard';
import { PlayerCareerStatsContent } from '../tournament/player-profile/PlayerCareerStatsContent';
import { PlayerProfileHeader } from '../tournament/player-profile/PlayerProfileHeader';
import { FIELD_ORANGE } from '../ui/fieldStyles';
import { Text } from '../ui/Text';
import { UnderlineTabBar } from '../ui/UnderlineTabBar';

const BALL_TYPE_TABS = [
  { value: BallType.Leather, label: 'Leather' },
  { value: BallType.Tennis, label: 'Tennis' },
] as const;

function emptyStatsMessage(ballType: typeof BallType.Leather | typeof BallType.Tennis): string {
  return ballType === BallType.Leather ? 'No Leather stats yet' : 'No Tennis stats yet';
}

/** Stats tab — logged-in player's overall career stats (reuses tournament profile components). */
export function OwnPlayerStatsScreen(): React.ReactElement {
  const router = useRouter();
  const [ballType, setBallType] = useState<typeof BallType.Leather | typeof BallType.Tennis>(
    BallType.Leather,
  );
  const [stats, setStats] = useState<OwnPlayerStatsView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getOwnPlayerStats(ballType)
      .then(setStats)
      .catch((err: unknown) => {
        setStats(null);
        setError(err instanceof ApiRequestError ? err.message : 'Could not load your stats.');
      })
      .finally(() => setLoading(false));
  }, [ballType]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-10 pt-2">
        {stats ? <PlayerProfileHeader profile={stats} /> : null}

        <UnderlineTabBar
          options={BALL_TYPE_TABS}
          value={ballType}
          onChange={setBallType}
          accessibilityLabel="Ball type"
          layout="spread"
        />

        {loading ? (
          <View className="items-center py-12">
            <ActivityIndicator color={FIELD_ORANGE} />
          </View>
        ) : null}

        {!loading && error ? (
          <Text className="font-sans text-sm text-primary">{error}</Text>
        ) : null}

        {!loading && stats && stats.career.matches === 0 ? (
          <View className="mt-4 rounded-xl border border-outline-variant bg-surface px-4 py-8">
            <Text className="text-center font-sans text-base text-text-muted">
              {emptyStatsMessage(ballType)}
            </Text>
          </View>
        ) : null}

        {!loading && stats && stats.career.matches === 0 ? (
          <View className="mt-3">
            <PlayerMomStatsCard
              summary={stats.manOfTheMatch}
              onPress={() =>
                router.push(`/stats/man-of-the-match?ballType=${encodeURIComponent(ballType)}`)
              }
            />
          </View>
        ) : null}

        {!loading && stats && stats.career.matches > 0 ? (
          <View className="mt-4">
            <PlayerCareerStatsContent
              ballTypeLabel={stats.ballTypeLabel}
              career={stats.career}
              byYear={stats.byYear}
              byTournament={stats.byTournament}
              showStumpingsCard={stats.showStumpingsCard}
              hideBallTypeLabel
              afterStatsGrid={
                <PlayerMomStatsCard
                  summary={stats.manOfTheMatch}
                  onPress={() =>
                    router.push(`/stats/man-of-the-match?ballType=${encodeURIComponent(ballType)}`)
                  }
                />
              }
            />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
