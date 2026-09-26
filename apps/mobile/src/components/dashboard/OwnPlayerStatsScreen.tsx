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
import { BallTypeSwitch } from '../ui/BallTypeSwitch';
import { Text } from '../ui/Text';

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
      .then((data) => {
        setStats(data);
        if (data.hasLeatherParticipation === false && ballType === BallType.Leather) {
          setBallType(BallType.Tennis);
        }
      })
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

  const showBallTypeSwitch = stats?.hasLeatherParticipation !== false;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1" contentContainerClassName="gap-4 px-4 pb-10 pt-2">
        <View className="flex-row items-center justify-between gap-3">
          <Text className="min-w-0 shrink font-sans-bold text-2xl text-on-surface">Stats</Text>
          {showBallTypeSwitch ? (
            <View className="shrink-0">
              <BallTypeSwitch value={ballType} onChange={setBallType} />
            </View>
          ) : null}
        </View>

        {stats ? <PlayerProfileHeader profile={stats} /> : null}

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
