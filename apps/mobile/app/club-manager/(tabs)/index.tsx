import { Ionicons } from '@expo/vector-icons';
import type { ClubManagerDashboard } from '@acc/types';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MatchSummaryCard } from '../../../src/components/ui/MatchSummaryCard';
import { StatTile } from '../../../src/components/ui/StatTile';
import { Text } from '../../../src/components/ui/Text';
import { TournamentDashboardCard } from '../../../src/components/ui/TournamentDashboardCard';
import { FIELD_ORANGE } from '../../../src/components/ui/fieldStyles';
import { ApiRequestError, getClubManagerDashboard } from '../../../src/lib/api';
import { useAuth } from '../../../src/lib/auth-context';

export default function ClubManagerDashboardScreen(): React.ReactElement {
  const router = useRouter();
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<ClubManagerDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getClubManagerDashboard()
      .then((data) => {
        if (!cancelled) setDashboard(data);
      })
      .catch((err: unknown) => {
        console.error('Failed to load club manager dashboard', err);
        if (!cancelled) {
          setError(
            err instanceof ApiRequestError
              ? err.message
              : 'Could not load dashboard. Check your connection.',
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

  useEffect(() => {
    return load();
  }, [load]);

  const performanceItems = dashboard?.playerStats
    ? [
        { label: 'Matches', value: dashboard.playerStats.matches },
        {
          label: 'Runs',
          value: dashboard.playerStats.runs,
          highlight: true,
        },
        {
          label: 'Wickets',
          value: String(dashboard.playerStats.wickets).padStart(2, '0'),
        },
      ]
    : [];

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <ScrollView contentContainerClassName="gap-6 px-4 pb-8 pt-4" showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center justify-between">
          <View className="flex-1 gap-1">
            <Text className="font-sans text-base text-on-surface-variant">Jay Swaminarayan,</Text>
            <Text className="font-sans-bold text-2xl text-primary">
              {user?.firstName ?? 'Manager'}
            </Text>
          </View>
          <View className="flex-row items-center gap-3">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Notifications"
              className="h-10 w-10 items-center justify-center rounded-full bg-white"
              style={{
                shadowColor: '#000',
                shadowOpacity: 0.06,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 3 },
                elevation: 2,
              }}
            >
              <Ionicons name="notifications-outline" size={22} color={FIELD_ORANGE} />
            </Pressable>
            {user?.profilePhotoUrl ? (
              <Image source={{ uri: user.profilePhotoUrl }} className="h-11 w-11 rounded-full" />
            ) : (
              <View className="h-11 w-11 items-center justify-center rounded-full bg-surface-container-high">
                <Text className="font-sans-bold text-lg text-primary">
                  {(user?.firstName ?? 'M').slice(0, 1).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        </View>

        {loading ? (
          <View className="items-center py-16">
            <ActivityIndicator color={FIELD_ORANGE} />
          </View>
        ) : error ? (
          <View className="rounded-xl bg-error-container px-4 py-3">
            <Text className="font-sans text-sm text-on-error-container">{error}</Text>
            <Pressable onPress={load} className="mt-2">
              <Text className="font-sans-semibold text-sm text-primary">Retry</Text>
            </Pressable>
          </View>
        ) : dashboard ? (
          <>
            {dashboard.featuredMatch ? (
              <MatchSummaryCard
                tournamentName={dashboard.featuredMatch.tournamentName}
                teamA={dashboard.featuredMatch.teamA}
                teamB={dashboard.featuredMatch.teamB}
                resultNote={dashboard.featuredMatch.resultNote}
                live={dashboard.featuredMatch.isLive}
                upcoming={dashboard.featuredMatch.isUpcoming}
                onPress={() => router.push(`/matches/${dashboard.featuredMatch!.matchId}`)}
              />
            ) : null}

            {dashboard.playerStats !== null ? (
              <View className="gap-3">
                <Text className="font-sans-bold text-xl text-on-surface">Your Performance</Text>
                <StatTile items={performanceItems} />
              </View>
            ) : null}

            <View className="gap-3">
              <View className="flex-row items-center justify-between">
                <Text className="font-sans-bold text-xl text-on-surface">Tournaments</Text>
                <Pressable
                  onPress={() => router.push('/tournaments/new')}
                  accessibilityRole="button"
                  accessibilityLabel="Add tournament"
                  className="h-10 w-10 items-center justify-center rounded-full bg-primary"
                >
                  <Ionicons name="add" size={24} color="#ffffff" />
                </Pressable>
              </View>
              {dashboard.tournaments.length === 0 ? (
                <Text className="font-sans text-sm text-on-surface-variant">No tournaments yet.</Text>
              ) : (
                dashboard.tournaments.map((tournament) => (
                  <TournamentDashboardCard
                    key={tournament.id}
                    tournament={tournament}
                    onPress={() => router.push(`/tournaments/${tournament.id}`)}
                  />
                ))
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
