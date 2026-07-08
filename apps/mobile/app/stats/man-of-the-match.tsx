import { BallType, PLAYER_PROFILE_BALL_TYPE_LABELS } from '@acc/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlayerMomMatchListCard } from '../../src/components/stats/PlayerMomMatchListCard';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import { Text } from '../../src/components/ui/Text';
import { FIELD_ORANGE } from '../../src/components/ui/fieldStyles';
import { ApiRequestError, getOwnPlayerMomMatches } from '../../src/lib/api';

function parseBallType(value: string | string[] | undefined): BallType {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === BallType.Tennis ? BallType.Tennis : BallType.Leather;
}

/** Logged-in player's Man of the Match awards for one ball type. */
export default function PlayerMomMatchesScreen(): React.ReactElement {
  const router = useRouter();
  const params = useLocalSearchParams<{ ballType?: string }>();
  const ballType = parseBallType(params.ballType);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Awaited<ReturnType<typeof getOwnPlayerMomMatches>> | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getOwnPlayerMomMatches(ballType)
      .then(setData)
      .catch((err: unknown) => {
        setData(null);
        setError(err instanceof ApiRequestError ? err.message : 'Could not load Man of the Match awards.');
      })
      .finally(() => setLoading(false));
  }, [ballType]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScreenHeader
        title="Man of the Match"
        subtitle={PLAYER_PROFILE_BALL_TYPE_LABELS[ballType]}
        onBack={() => router.back()}
      />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={FIELD_ORANGE} />
        </View>
      ) : null}

      {!loading && error ? (
        <View className="px-4 py-6">
          <Text className="font-sans text-sm text-primary">{error}</Text>
        </View>
      ) : null}

      {!loading && !error && data && data.count === 0 ? (
        <View className="mx-4 mt-4 rounded-xl border border-outline-variant bg-surface px-4 py-8">
          <Text className="text-center font-sans text-base text-text-muted">
            No Man of the Match awards yet
          </Text>
        </View>
      ) : null}

      {!loading && !error && data && data.count > 0 ? (
        <FlatList
          data={data.matches}
          keyExtractor={(item) => item.matchId}
          contentContainerClassName="gap-3 px-4 pb-8 pt-2"
          renderItem={({ item }) => (
            <PlayerMomMatchListCard
              match={item}
              onPress={() => router.push(`/matches/${item.matchId}/scorecard`)}
            />
          )}
        />
      ) : null}
    </SafeAreaView>
  );
}
