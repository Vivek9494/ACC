import type { CaptainDashboard, CaptainScorerAssignmentMatch, ScorerStartableMatch, AuthUser } from '@acc/types';
import type { Router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { buildCaptainFeaturedMatchSections } from './buildDashboardFeaturedMatchSections';
import { buildTeamLeadPollSections } from './buildTeamLeadPollSections';
import { ConfirmScorecardDashboardCard } from './ConfirmScorecardDashboardCard';
import { ScorerStartMatchCard } from './ScorerStartMatchCard';
import { Button } from '../ui/Button';
import { StatTile } from '../ui/StatTile';
import { Text } from '../ui/Text';
import { TournamentDashboardCard } from '../ui/TournamentDashboardCard';
import {
  handleScorerDashboardPress,
  scorerDashboardButtonLabel,
} from '../../lib/scorer-dashboard';
import { tournamentDetailHref } from '../../lib/tournament-detail-route';

export function buildCaptainDashboardSections(
  dashboard: CaptainDashboard,
  router: Router,
  user: AuthUser,
  onOpenScorerAssignment?: (match: CaptainScorerAssignmentMatch) => void,
  onParticipationPollUpdated?: () => void,
  onOpenMatchSetup?: (match: ScorerStartableMatch) => void,
): ReactNode[] {
  const performanceItems = [
    { label: 'Matches', value: dashboard.playerStats.matches },
    { label: 'Runs', value: dashboard.playerStats.runs, highlight: true },
    {
      label: 'Wickets',
      value: String(dashboard.playerStats.wickets).padStart(2, '0'),
    },
  ];

  const mom = dashboard.pendingManOfMatch;

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
    ...dashboard.pendingScorecardConfirmations.map((item) => (
      <ConfirmScorecardDashboardCard
        key={`confirm-scorecard-${item.matchId}`}
        item={item}
        onPress={() => router.push(`/matches/${item.matchId}/scorecard`)}
      />
    )),
    ...buildCaptainFeaturedMatchSections(dashboard.featuredMatches, router),
    ...buildTeamLeadPollSections(
      dashboard.upcomingMatchCard,
      dashboard.participationPoll,
      onOpenScorerAssignment,
      onParticipationPollUpdated,
    ),
    mom ? (
      <View
        key="pending-mom"
        className={`gap-2 rounded-xl border p-4 ${
          mom.overdue ? 'border-secondary-700 bg-secondary-100/30' : 'border-primary bg-primary-container/40'
        }`}
      >
        <Text className={`font-sans-bold text-lg ${mom.overdue ? 'text-secondary-900' : 'text-primary'}`}>
          Man of the Match — Required
        </Text>
        {mom.resultLine ? (
          <Text className="font-sans text-sm text-on-surface-variant">{mom.resultLine}</Text>
        ) : null}
        {mom.dueAt ? (
          <Text
            className={`font-sans text-sm ${mom.overdue ? 'text-secondary-900' : 'text-on-surface-variant'}`}
          >
            {mom.overdue
              ? `Overdue — required by end of match day (${mom.dueAt.slice(0, 10)})`
              : `Required by end of match day (${mom.dueAt.slice(0, 10)})`}
          </Text>
        ) : null}
        <Text className="font-sans text-sm text-on-surface-variant">
          Select the player of the match for {mom.teamName}.
        </Text>
        <Button
          label="Select Man of the Match"
          onPress={() => router.push(`/matches/${mom.matchId}/scorecard`)}
          className="h-11"
        />
      </View>
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
