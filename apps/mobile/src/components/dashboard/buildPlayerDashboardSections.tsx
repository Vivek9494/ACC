import type { PlayerDashboard } from '@acc/types';
import type { Router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { ScorerStartMatchCard } from './ScorerStartMatchCard';
import { MatchSummaryCard } from '../ui/MatchSummaryCard';
import { StatTile } from '../ui/StatTile';
import { Text } from '../ui/Text';
import { TournamentDashboardCard } from '../ui/TournamentDashboardCard';

export function buildPlayerDashboardSections(
  dashboard: PlayerDashboard,
  router: Router,
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
    dashboard.scorerMatch ? (
      <ScorerStartMatchCard
        key="scorer-match"
        match={dashboard.scorerMatch}
        onStartPress={() => router.push(`/matches/${dashboard.scorerMatch!.matchId}/start-setup`)}
      />
    ) : null,
    dashboard.featuredMatch ? (
      <MatchSummaryCard
        key="featured-match"
        tournamentName={dashboard.featuredMatch.tournamentName}
        teamA={dashboard.featuredMatch.teamA}
        teamB={dashboard.featuredMatch.teamB}
        status={dashboard.featuredMatch.status}
        infoLine={dashboard.featuredMatch.infoLine}
        resultLine={dashboard.featuredMatch.resultLine}
        onPress={() => router.push(`/matches/${dashboard.featuredMatch!.matchId}`)}
      />
    ) : null,
    <View key="performance" className="gap-3">
      <Text className="font-sans-bold text-xl text-on-surface">Your Performance</Text>
      <StatTile items={performanceItems} />
    </View>,
    <View key="tournaments" className="gap-3">
      <Text className="font-sans-bold text-xl text-on-surface">Tournaments</Text>
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
    </View>,
  ].filter((section) => section !== null);
}
