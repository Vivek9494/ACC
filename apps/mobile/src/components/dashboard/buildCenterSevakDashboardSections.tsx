import { type CenterSevakDashboard, type AuthUser } from '@acc/types';
import type { Router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { buildCaptainFeaturedMatchSections } from './buildDashboardFeaturedMatchSections';
import { ParticipationPollCard } from './ParticipationPollCard';
import { YourPerformanceSection } from './YourPerformanceSection';
import { CircularAddButton } from '../ui/CircularAddButton';
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
  return [
    ...buildCaptainFeaturedMatchSections(dashboard.featuredMatches, router),
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
              { onDeleted: onTournamentDeleted, user },
            )}
          />
        ))}
      </View>
    ) : null,
  ].filter((section) => section !== null);
}
