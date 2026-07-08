import {
  type PlayerDashboard,
  type ScorerStartableMatch,
  type AuthUser,
} from '@acc/types';
import type { Router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { buildCaptainFeaturedMatchSections } from './buildDashboardFeaturedMatchSections';
import { ParticipationPollCard } from './ParticipationPollCard';
import { ScorerStartMatchCard } from './ScorerStartMatchCard';
import { StatTile } from '../ui/StatTile';
import { Text } from '../ui/Text';
import { TournamentDashboardCard } from '../ui/TournamentDashboardCard';
import {
  handleScorerDashboardPress,
  scorerDashboardButtonLabel,
} from '../../lib/scorer-dashboard';
import { tournamentDetailHref } from '../../lib/tournament-detail-route';

export function buildPlayerDashboardSections(
  dashboard: PlayerDashboard,
  router: Router,
  user: AuthUser,
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
    ...buildCaptainFeaturedMatchSections(dashboard.featuredMatches ?? [], router),
    dashboard.participationPoll?.isOpen ? (
      <ParticipationPollCard
        key="participation-poll"
        poll={dashboard.participationPoll}
        onPollUpdated={() => onParticipationPollUpdated?.()}
      />
    ) : null,
    <View key="performance" className="gap-3">
      <Text className="font-sans-bold text-xl text-on-surface">Your Performance</Text>
      <StatTile items={performanceItems} />
    </View>,
    dashboard.tournaments.length > 0 ? (
      <View key="tournaments" className="gap-3">
        <Text className="font-sans-bold text-xl text-on-surface">Tournaments</Text>
        {dashboard.tournaments.map((tournament) => (
          <TournamentDashboardCard
            key={tournament.id}
            tournament={tournament}
            onPress={() => router.push(tournamentDetailHref(user, tournament.id))}
          />
        ))}
      </View>
    ) : null,
  ].filter((section) => section !== null);
}
