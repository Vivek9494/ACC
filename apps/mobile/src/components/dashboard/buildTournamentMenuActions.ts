import type { AuthUser, TournamentDashboardPermissions } from '@acc/types';
import type { Router } from 'expo-router';
import { Alert } from 'react-native';

import { ApiRequestError, deleteTournament } from '../../lib/api';
import { confirmDestructiveDeleteAlert } from '../../lib/confirm-destructive-delete';
import { tournamentSubpathHref } from '../../lib/tournament-detail-route';
import type { OverflowMenuAction } from '../ui/OverflowMenu';

export function buildTournamentMenuActions(
  permissions: TournamentDashboardPermissions,
  tournamentId: string,
  tournamentName: string,
  router: Router,
  options?: {
    onDeleted?: () => void;
    includeManageCenterPlayers?: boolean;
    user?: AuthUser | null;
  },
): OverflowMenuAction[] {
  const actions: OverflowMenuAction[] = [];
  const user = options?.user ?? null;

  if (options?.includeManageCenterPlayers && permissions.canManageCenterPlayers) {
    actions.push({
      key: 'manage-center-players',
      label: 'Manage center players',
      icon: 'people-outline',
      onPress: () =>
        router.push(tournamentSubpathHref(user, tournamentId, 'registrations/players')),
    });
    actions.push({
      key: 'verify-players',
      label: 'Verify players',
      icon: 'checkmark-done-outline',
      onPress: () =>
        router.push(tournamentSubpathHref(user, tournamentId, 'registrations/queue')),
    });
  }

  if (permissions.canEdit) {
    actions.push({
      key: 'edit-tournament',
      label: 'Edit tournament',
      icon: 'create-outline',
      onPress: () => router.push(tournamentSubpathHref(user, tournamentId, 'edit')),
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
