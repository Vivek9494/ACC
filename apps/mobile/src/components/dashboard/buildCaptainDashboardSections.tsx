import type { CaptainDashboard, CaptainScorerAssignmentMatch } from '@acc/types';
import type { Router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { CaptainUpcomingMatchCard } from './CaptainUpcomingMatchCard';
import { ParticipationPollCard } from './ParticipationPollCard';
import { Button } from '../ui/Button';
import { MatchSummaryCard } from '../ui/MatchSummaryCard';
import { StatTile } from '../ui/StatTile';
import { Text } from '../ui/Text';
import { TournamentDashboardCard } from '../ui/TournamentDashboardCard';

export function buildCaptainDashboardSections(
  dashboard: CaptainDashboard,
  router: Router,
  onOpenScorerAssignment?: (match: CaptainScorerAssignmentMatch) => void,
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

  const mom = dashboard.pendingManOfMatch;
  const featured = dashboard.featuredMatch;
  const showFeaturedOnly =
    featured != null &&
    (featured.status === 'LIVE' ||
      featured.status === 'COMPLETED' ||
      dashboard.upcomingMatchCard == null);

  return [
    showFeaturedOnly && featured ? (
      <MatchSummaryCard
        key="featured-match"
        tournamentName={featured.tournamentName}
        teamA={featured.teamA}
        teamB={featured.teamB}
        status={featured.status}
        infoLine={featured.infoLine}
        resultLine={featured.resultLine}
        onPress={() =>
          router.push(
            featured.status === 'LIVE'
              ? `/matches/${featured.matchId}/live`
              : `/matches/${featured.matchId}`,
          )
        }
      />
    ) : null,
    dashboard.upcomingMatchCard ? (
      <CaptainUpcomingMatchCard
        key="upcoming-match-card"
        card={dashboard.upcomingMatchCard}
        onOpenScorerAssignment={onOpenScorerAssignment}
        onPollUpdated={onParticipationPollUpdated}
      />
    ) : null,
    dashboard.participationPoll ? (
      <ParticipationPollCard
        key="participation-poll"
        poll={dashboard.participationPoll}
        onPollUpdated={() => onParticipationPollUpdated?.()}
      />
    ) : null,
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
