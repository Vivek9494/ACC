import { Ionicons } from '@expo/vector-icons';
import type { ClubManagerDashboard } from '@acc/types';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { colors } from '@/theme/colors';

import { buildTournamentMenuActions } from '../../../src/components/dashboard/buildTournamentMenuActions';
import { DashboardScaffold } from '../../../src/components/dashboard/DashboardScaffold';
import { MatchSummaryCard } from '../../../src/components/ui/MatchSummaryCard';
import { StatTile } from '../../../src/components/ui/StatTile';
import { Text } from '../../../src/components/ui/Text';
import { TournamentDashboardCard } from '../../../src/components/ui/TournamentDashboardCard';
import { getClubManagerDashboard } from '../../../src/lib/api';
import { dashboardFetchError, logFetchError } from '../../../src/lib/fetch-error';

export default function ClubManagerDashboardScreen(): React.ReactElement {
  const router = useRouter();
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
        logFetchError('Failed to load club manager dashboard', err);
        if (!cancelled) {
          setError(dashboardFetchError(err));
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

  const sections = useMemo(() => {
    if (!dashboard) {
      return [];
    }

    const performanceItems =
      dashboard.playerStats != null
        ? [
            { label: 'Matches', value: dashboard.playerStats.matches },
            { label: 'Runs', value: dashboard.playerStats.runs, highlight: true },
            {
              label: 'Wickets',
              value: String(dashboard.playerStats.wickets).padStart(2, '0'),
            },
          ]
        : [];

    return [
      dashboard.featuredMatch ? (
        <MatchSummaryCard
          key="featured-match"
          tournamentName={dashboard.featuredMatch.tournamentName}
          teamA={dashboard.featuredMatch.teamA}
          teamB={dashboard.featuredMatch.teamB}
          status={
            dashboard.featuredMatch.isLive
              ? 'LIVE'
              : dashboard.featuredMatch.isUpcoming
                ? 'UPCOMING'
                : 'COMPLETED'
          }
          resultLine={dashboard.featuredMatch.resultNote}
          onPress={() =>
            router.push(
              dashboard.featuredMatch.isLive
                ? `/matches/${dashboard.featuredMatch!.matchId}/live`
                : `/matches/${dashboard.featuredMatch!.matchId}`,
            )
          }
        />
      ) : null,
      dashboard.playerStats != null ? (
        <View key="performance" className="gap-3">
          <Text className="font-sans-bold text-xl text-on-surface">Your Performance</Text>
          <StatTile items={performanceItems} />
        </View>
      ) : null,
      <View key="tournaments" className="gap-3">
        <View className="flex-row items-center justify-between">
          <Text className="font-sans-bold text-xl text-on-surface">Tournaments</Text>
          <Pressable
            onPress={() => router.push('/tournaments/new')}
            accessibilityRole="button"
            accessibilityLabel="Add tournament"
            className="h-10 w-10 items-center justify-center rounded-full bg-primary"
          >
            <Ionicons name="add" size={24} color={colors.textInverse} />
          </Pressable>
        </View>
        {dashboard.tournaments.length === 0 ? (
          <Text className="font-sans text-sm text-on-surface-variant">No tournaments yet.</Text>
        ) : (
          dashboard.tournaments.map(({ tournament, permissions }) => (
            <TournamentDashboardCard
              key={tournament.id}
              tournament={tournament}
              onPress={() => router.push(`/tournaments/${tournament.id}`)}
              menuActions={buildTournamentMenuActions(
                permissions,
                tournament.id,
                tournament.name,
                router,
                { onDeleted: load },
              )}
            />
          ))
        )}
      </View>,
    ].filter((section) => section !== null);
  }, [dashboard, router]);

  return (
    <DashboardScaffold
      headerFallbackName="Manager"
      isLoading={loading}
      error={error}
      onRetry={load}
      sections={sections}
    />
  );
}
