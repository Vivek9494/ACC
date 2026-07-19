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
import { YourPerformanceSection } from './YourPerformanceSection';
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
    <YourPerformanceSection key="performance" performance={dashboard.playerStats} />,
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
