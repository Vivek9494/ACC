import type { GuestDashboard } from '@acc/types';
import type { Router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import type { OverflowMenuAction } from '../ui/OverflowMenu';
import { LiveMatchCard } from '../ui/LiveMatchCard';
import { Text } from '../ui/Text';
import { TournamentDashboardCard } from '../ui/TournamentDashboardCard';

function guestTournamentMenu(tournamentId: string, router: Router): OverflowMenuAction[] {
  return [
    {
      key: 'view-details',
      label: 'View details',
      icon: 'eye-outline',
      onPress: () => router.push(`/tournaments/${tournamentId}`),
    },
  ];
}

export function buildGuestDashboardSections(
  dashboard: GuestDashboard,
  router: Router,
): ReactNode[] {
  return [
    dashboard.featuredLiveMatch ? (
      <LiveMatchCard
        key="featured-live"
        match={dashboard.featuredLiveMatch}
        onPress={() => router.push(`/matches/${dashboard.featuredLiveMatch!.matchId}/live`)}
      />
    ) : null,
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
            menuActions={guestTournamentMenu(tournament.id, router)}
          />
        ))
      )}
    </View>,
  ].filter((section) => section !== null);
}
