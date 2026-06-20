import { BallType, type CenterSevakDashboard } from '@acc/types';
import type { Router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';

import { MatchSummaryCard } from '../ui/MatchSummaryCard';
import { StatTile } from '../ui/StatTile';
import { Text } from '../ui/Text';
import { TournamentDashboardCard } from '../ui/TournamentDashboardCard';
import { buildTournamentMenuActions } from './buildTournamentMenuActions';

export function buildCenterSevakDashboardSections(
  dashboard: CenterSevakDashboard,
  router: Router,
  onTournamentDeleted?: () => void,
): ReactNode[] {
  const performanceItems = [
    { label: 'Matches', value: dashboard.playerStats.matches },
    { label: 'Runs', value: dashboard.playerStats.runs, highlight: true },
    {
      label: 'Wickets',
      value: String(dashboard.playerStats.wickets).padStart(2, '0'),
    },
  ];

  return [
    dashboard.featuredMatch ? (
      <MatchSummaryCard
        key="featured-match"
        tournamentName={dashboard.featuredMatch.tournamentName}
        teamA={dashboard.featuredMatch.teamA}
        teamB={dashboard.featuredMatch.teamB}
        status="COMPLETED"
        resultLine={dashboard.featuredMatch.resultNote}
        onPress={() => router.push(`/matches/${dashboard.featuredMatch!.matchId}`)}
      />
    ) : null,
    <View key="performance" className="gap-3">
      <Text className="font-sans-bold text-xl text-on-surface">Your Performance</Text>
      <StatTile items={performanceItems} />
    </View>,
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
              {
                onDeleted: onTournamentDeleted,
                includeManageCenterPlayers: tournament.ballType === BallType.Tennis,
              },
            )}
          />
        ))
      )}
    </View>,
  ].filter((section) => section !== null);
}
