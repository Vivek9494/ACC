import type { TournamentDashboardPermissions } from '@acc/types';
import type { Router } from 'expo-router';
import { Alert } from 'react-native';

import { ApiRequestError, deleteTournament } from '../../lib/api';
import { confirmDestructiveDeleteAlert } from '../../lib/confirm-destructive-delete';
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
  const actions: OverflowMenuAction[] = [];

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
      secondary: true,
      onPress: () => router.push(`/tournaments/${tournamentId}/edit`),
    });
  }

  if (permissions.canDelete) {
    actions.push({
      key: 'delete-tournament',
      label: 'Delete tournament',
      icon: 'trash-outline',
      destructive: true,
      onPress: () => {
        confirmDestructiveDeleteAlert({
          title: 'Delete Tournament?',
          message: `Delete "${tournamentName}"?`,
          onConfirm: async () => {
            try {
              await deleteTournament(tournamentId);
              options?.onDeleted?.();
              Alert.alert('Tournament deleted', `"${tournamentName}" was removed.`);
            } catch (err: unknown) {
              Alert.alert(
                'Could not delete tournament',
                err instanceof ApiRequestError
                  ? err.message
                  : 'You do not have permission to delete this tournament.',
              );
            }
          },
        });
      },
    });
  }

  return actions;
}
