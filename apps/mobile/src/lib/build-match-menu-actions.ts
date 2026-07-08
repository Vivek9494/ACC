import {
  MatchCardDisplayState,
  MatchSchedulingFormat,
  type MatchListItem,
} from '@acc/types';
import type { Router } from 'expo-router';
import { Alert } from 'react-native';

import { ApiRequestError, deleteMatch } from './api';
import { confirmDestructiveDeleteAlert } from './confirm-destructive-delete';
import type { OverflowMenuAction } from '../components/ui/OverflowMenu';

export function buildMatchMenuActions(
  match: MatchListItem,
  tournamentId: string,
  tournamentSchedulingFormat: MatchSchedulingFormat | null | undefined,
  router: Router,
  options?: {
    onDeleted?: () => void;
    canManage?: boolean;
  },
): OverflowMenuAction[] {
  if (!options?.canManage || match.isDeleted) {
    return [];
  }
  if (match.displayState !== MatchCardDisplayState.Scheduled) {
    return [];
  }

  const actions: OverflowMenuAction[] = [];

  if (match.canEdit !== false) {
    actions.push({
      key: 'edit-match',
      label: 'Edit',
      icon: 'create-outline',
      onPress: () => {
        router.push({
          pathname: '/tournaments/[id]/match-setup',
          params: {
            id: tournamentId,
            format: tournamentSchedulingFormat ?? MatchSchedulingFormat.Manual,
            matchId: match.id,
          },
        });
      },
    });
  }

  if (match.canDelete !== false) {
    actions.push({
      key: 'delete-match',
      label: 'Delete',
      icon: 'trash-outline',
      destructive: true,
      onPress: () => {
        confirmDestructiveDeleteAlert({
          title: 'Delete this match?',
          message: "This can't be undone.",
          onConfirm: async () => {
            try {
              await deleteMatch(match.id);
              options?.onDeleted?.();
            } catch (err: unknown) {
              Alert.alert(
                'Could not delete match',
                err instanceof ApiRequestError
                  ? err.message
                  : 'You do not have permission to delete this match.',
              );
            }
          },
        });
      },
    });
  }

  return actions;
}
