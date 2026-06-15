import type { TournamentDashboardPermissions } from '@acc/types';
import type { Router } from 'expo-router';
import { Alert } from 'react-native';

import { ApiRequestError, deleteTournament } from '../../lib/api';
import type { OverflowMenuAction } from '../ui/OverflowMenu';

export function buildTournamentMenuActions(
  permissions: TournamentDashboardPermissions,
  tournamentId: string,
  tournamentName: string,
  router: Router,
  options?: {
    onDeleted?: () => void;
    includeManageCenterPlayers?: boolean;
  },
): OverflowMenuAction[] {
  const actions: OverflowMenuAction[] = [
    {
      key: 'view-details',
      label: 'View details',
      icon: 'eye-outline',
      onPress: () => router.push(`/tournaments/${tournamentId}`),
    },
  ];

  if (options?.includeManageCenterPlayers && permissions.canManageCenterPlayers) {
    actions.push({
      key: 'manage-center-players',
      label: 'Manage center players',
      icon: 'people-outline',
      onPress: () => router.push(`/registrations/${tournamentId}/players`),
    });
    actions.push({
      key: 'verify-players',
      label: 'Verify players',
      icon: 'checkmark-done-outline',
      onPress: () => router.push(`/registrations/${tournamentId}/queue`),
    });
  }

  if (permissions.canEdit) {
    actions.push({
      key: 'edit-tournament',
      label: 'Edit tournament',
      icon: 'create-outline',
      onPress: () => router.push(`/tournaments/${tournamentId}/edit`),
    });
  }

  if (permissions.canDelete) {
    actions.push({
      key: 'delete-tournament',
      label: 'Delete tournament',
      icon: 'trash-outline',
      onPress: () => {
        Alert.alert('Delete Tournament?', `Delete "${tournamentName}"?`, [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              void deleteTournament(tournamentId)
                .then(() => {
                  options?.onDeleted?.();
                  Alert.alert('Tournament deleted', `"${tournamentName}" was removed.`);
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
        ]);
      },
    });
  }

  return actions;
}
