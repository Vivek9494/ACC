import { BallType, type CenterSevakDashboard, type AuthUser } from '@acc/types';
import type { Router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { buildCaptainFeaturedMatchSections } from './buildDashboardFeaturedMatchSections';
import { ParticipationPollCard } from './ParticipationPollCard';
import { CircularAddButton } from '../ui/CircularAddButton';
import { StatTile } from '../ui/StatTile';
import { Text } from '../ui/Text';
import { TournamentDashboardCard } from '../ui/TournamentDashboardCard';
import { buildTournamentMenuActions } from './buildTournamentMenuActions';
import { tournamentDetailHref, tournamentNewHref } from '../../lib/tournament-detail-route';

export function buildCenterSevakDashboardSections(
  dashboard: CenterSevakDashboard,
  router: Router,
  user: AuthUser,
  onTournamentDeleted?: () => void,
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
    ...buildCaptainFeaturedMatchSections(dashboard.featuredMatches, router),
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
        <View className="flex-row items-center justify-between">
          <Text className="font-sans-bold text-xl text-on-surface">Tournaments</Text>
          <CircularAddButton
            accessibilityLabel="Add tournament"
            onPress={() => router.push(tournamentNewHref(user))}
          />
        </View>
        {dashboard.tournaments.map(({ tournament, permissions }) => (
          <TournamentDashboardCard
            key={tournament.id}
            tournament={tournament}
            onPress={() => router.push(tournamentDetailHref(user, tournament.id))}
            menuActions={buildTournamentMenuActions(
              permissions,
              tournament.id,
              tournament.name,
              router,
              {
                onDeleted: onTournamentDeleted,
                includeManageCenterPlayers: tournament.ballType === BallType.Tennis,
                user,
              },
            )}
          />
        ))}
      </View>
    ) : null,
  ].filter((section) => section !== null);
}
