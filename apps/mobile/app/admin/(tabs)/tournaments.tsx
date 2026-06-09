import type { TournamentSummary } from '@acc/types';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '../../../src/components/ui/Text';
import { TournamentDashboardCard } from '../../../src/components/ui/TournamentDashboardCard';
import { ApiRequestError, listTournaments } from '../../../src/lib/api';

export default function AdminTournamentsTabScreen(): React.ReactElement {
  const router = useRouter();
  const [tournaments, setTournaments] = useState<TournamentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      listTournaments()
        .then((list) => {
          if (!cancelled) {
            setTournaments(list);
            setError(null);
          }
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setError(err instanceof ApiRequestError ? err.message : 'Could not load tournaments.');
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <View className="px-4 pt-4">
        <Text className="font-sans-bold text-2xl text-on-surface">Tournaments</Text>
      </View>
      <ScrollView contentContainerClassName="gap-4 px-4 py-4 pb-8">
        {loading ? (
          <ActivityIndicator color="#a04100" className="py-12" />
        ) : error ? (
          <View className="rounded-xl bg-error-container px-4 py-3">
            <Text className="font-sans text-sm text-on-error-container">{error}</Text>
          </View>
        ) : tournaments.length === 0 ? (
          <Text className="font-sans text-sm text-on-surface-variant">No tournaments yet.</Text>
        ) : (
          tournaments.map((tournament) => (
            <TournamentDashboardCard
              key={tournament.id}
              tournament={tournament}
              onPress={() => router.push(`/tournaments/${tournament.id}`)}
            />
          ))
        )}
        <Pressable onPress={() => router.push('/tournaments/new')} className="py-2">
          <Text className="text-center font-sans-semibold text-sm text-primary">+ Add Tournament</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
