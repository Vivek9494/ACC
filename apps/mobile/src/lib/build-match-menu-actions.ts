import {
  MatchCardDisplayState,
  MatchSchedulingFormat,
  type AuthUser,
  type MatchListItem,
} from '@acc/types';
import type { Router } from 'expo-router';
import { Alert } from 'react-native';

import { ApiRequestError, deleteMatch } from './api';
import { confirmDestructiveDeleteAlert } from './confirm-destructive-delete';
import { tournamentSubpathHref } from './tournament-detail-route';
import type { OverflowMenuAction } from '../components/ui/OverflowMenu';

export function buildMatchMenuActions(
  match: MatchListItem,
  tournamentId: string,
  tournamentSchedulingFormat: MatchSchedulingFormat | null | undefined,
  router: Router,
  options?: {
    onDeleted?: () => void;
    canManage?: boolean;
    user?: AuthUser | null;
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
        router.push(
          tournamentSubpathHref(options.user ?? null, tournamentId, 'match-setup', {
            format: tournamentSchedulingFormat ?? MatchSchedulingFormat.Manual,
            matchId: match.id,
          }),
        );
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
