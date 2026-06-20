import { type TournamentSummary } from '@acc/types';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, View } from 'react-native';
import { Button } from '../../src/components/ui/Button';
import { Text } from '../../src/components/ui/Text';
import { BallTypeIcon } from '../../src/components/ui/BallTypeIcon';
import { FIELD_ORANGE } from '../../src/components/ui/fieldStyles';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StateBadge } from '../../src/components/StateBadge';
import { ApiRequestError, listTournaments } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth-context';
import { canCreateTournament } from '../../src/lib/can-create-tournament';

const TYPE_LABELS: Record<TournamentSummary['type'], string> = {
  ACC: 'ACC',
  APL: 'APL',
  CENTER: 'Center-level',
};

export default function TournamentsScreen(): React.ReactElement {
  const router = useRouter();
  const { user } = useAuth();
  const [tournaments, setTournaments] = useState<TournamentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canCreate = canCreateTournament(user);

  const load = useCallback(() => {
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
          setError(
            err instanceof ApiRequestError ? err.message : 'Could not load tournaments.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(load);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-6 pt-6">
        <View>
          <Text className="font-sans-medium text-sm uppercase tracking-widest text-primary">
            Atmiya Cricket Club
          </Text>
          <Text className="font-sans-bold text-3xl text-on-surface">Tournaments</Text>
        </View>
        {canCreate ? (
          <Button
            onPress={() => router.push('/tournaments/new')}
            className="h-11 px-5"
            label="+ Add"
          />
        ) : null}
      </View>

      <ScrollView contentContainerClassName="px-6 py-6 gap-3">
        {loading ? (
          <View className="items-center py-16">
            <ActivityIndicator color={FIELD_ORANGE} />
          </View>
        ) : error ? (
          <View className="rounded-lg bg-primary-50 px-4 py-3">
            <Text className="font-sans text-sm text-primary">{error}</Text>
          </View>
        ) : tournaments.length === 0 ? (
          <View className="items-center py-16">
            <Text className="font-sans text-base text-on-surface-variant">
              No tournaments yet.
            </Text>
          </View>
        ) : (
          tournaments.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => router.push(`/tournaments/${t.id}`)}
              className="flex-row items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-3 active:opacity-80"
            >
              {t.posterUrl ? (
                <Image
                  source={{ uri: t.posterUrl }}
                  className="h-14 w-14 rounded-lg"
                  resizeMode="cover"
                />
              ) : (
                <View className="h-14 w-14 items-center justify-center rounded-lg bg-surface-container-high">
                  <Text className="font-sans-bold text-lg text-on-surface-variant">
                    {t.name.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
              )}
              <View className="flex-1 gap-1">
                <View className="flex-row items-center gap-2">
                  <BallTypeIcon ballType={t.ballType} size={20} />
                  <Text className="flex-1 font-sans-semibold text-base text-on-surface" numberOfLines={1}>
                    {t.name}
                  </Text>
                </View>
                <Text className="font-sans text-sm text-on-surface-variant">
                  {TYPE_LABELS[t.type]} • {t.year} • {t.teamCount}{' '}
                  {t.teamCount === 1 ? 'team' : 'teams'}
                </Text>
              </View>
              <StateBadge state={t.state} />
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
