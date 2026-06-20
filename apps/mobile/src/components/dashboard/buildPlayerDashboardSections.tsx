import type { PlayerDashboard, ScorerStartableMatch } from '@acc/types';
import type { Router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { ParticipationPollCard } from './ParticipationPollCard';
import { ScorerStartMatchCard } from './ScorerStartMatchCard';
import { MatchSummaryCard } from '../ui/MatchSummaryCard';
import { StatTile } from '../ui/StatTile';
import { Text } from '../ui/Text';
import { TournamentDashboardCard } from '../ui/TournamentDashboardCard';
import {
  handleScorerDashboardPress,
  scorerDashboardButtonLabel,
} from '../../lib/scorer-dashboard';

export function buildPlayerDashboardSections(
  dashboard: PlayerDashboard,
  router: Router,
  onOpenMatchSetup?: (match: ScorerStartableMatch) => void,
  onParticipationPollUpdated?: () => void,
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
        buttonLabel={scorerDashboardButtonLabel(dashboard.scorerMatch)}
        onStartPress={() =>
          handleScorerDashboardPress(
            dashboard.scorerMatch!,
            router,
            onOpenMatchSetup,
          )
        }
      />
    ) : null,
    dashboard.participationPoll ? (
      <ParticipationPollCard
        key="participation-poll"
        poll={dashboard.participationPoll}
        onPollUpdated={() => onParticipationPollUpdated?.()}
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
        onPress={() =>
          router.push(
            dashboard.featuredMatch!.status === 'LIVE'
              ? `/matches/${dashboard.featuredMatch!.matchId}/live`
              : `/matches/${dashboard.featuredMatch!.matchId}`,
          )
        }
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
