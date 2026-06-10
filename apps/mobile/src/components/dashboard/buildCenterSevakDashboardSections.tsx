import type { CenterSevakDashboard, TournamentDashboardPermissions } from '@acc/types';
import type { Router } from 'expo-router';
import type { ReactNode } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ApiRequestError, deleteTournament } from '../../lib/api';
import type { OverflowMenuAction } from '../ui/OverflowMenu';
import { MatchSummaryCard } from '../ui/MatchSummaryCard';
import { StatTile } from '../ui/StatTile';
import { Text } from '../ui/Text';
import { TournamentDashboardCard } from '../ui/TournamentDashboardCard';

function tournamentMenuActions(
  permissions: TournamentDashboardPermissions,
  tournamentId: string,
  tournamentName: string,
  router: Router,
  onDeleted?: () => void,
): OverflowMenuAction[] {
  const actions: OverflowMenuAction[] = [
    {
      key: 'view-details',
      label: 'View details',
      icon: 'eye-outline',
      onPress: () => router.push(`/tournaments/${tournamentId}`),
    },
  ];

  if (permissions.canManageCenterPlayers) {
    actions.push({
      key: 'manage-center-players',
      label: 'Manage center players',
      icon: 'people-outline',
      onPress: () => router.push(`/registrations/${tournamentId}/players`),
    });
  }

  if (permissions.canEdit) {
    actions.push({
      key: 'edit-tournament',
      label: 'Edit tournament',
      icon: 'create-outline',
      onPress: () => router.push(`/tournaments/${tournamentId}`),
    });
  }

  if (permissions.canDelete) {
    actions.push({
      key: 'delete-tournament',
      label: 'Delete tournament',
      icon: 'trash-outline',
      onPress: () => {
        Alert.alert(
          'Delete tournament',
          `Delete "${tournamentName}"? This cannot be undone.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => {
                void deleteTournament(tournamentId)
                  .then(() => {
                    onDeleted?.();
                  })
                  .catch((err: unknown) => {
                    Alert.alert(
                      'Could not delete tournament',
                      err instanceof ApiRequestError
                        ? err.message
                        : 'You do not have permission to delete this tournament.',
                    );
                  });
              },
            },
          ],
        );
      },
    });
  }

  return actions;
}

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
          <Ionicons name="add" size={24} color="#ffffff" />
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
            menuActions={tournamentMenuActions(
              permissions,
              tournament.id,
              tournament.name,
              router,
              onTournamentDeleted,
            )}
          />
        ))
      )}
    </View>,
  ].filter((section) => section !== null);
}
