import {
  MatchCardDisplayState,
  MatchSchedulingFormat,
  isDeletableMatchState,
  isScoredMatchState,
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
  const actions: OverflowMenuAction[] = [];

  if (match.displayState === MatchCardDisplayState.Scheduled && match.canEdit !== false) {
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

  if (isDeletableMatchState(match.state) && match.canDelete !== false) {
    actions.push({
      key: 'delete-match',
      label: 'Delete',
      icon: 'trash-outline',
      destructive: true,
      onPress: () => {
        confirmDestructiveDeleteAlert({
          title: 'Delete this match?',
          message: isScoredMatchState(match.state)
            ? "This match has a full scorecard. Deleting it removes its runs, wickets and result from player career stats, leaderboards and the points table — including other teams' net run rate. The record is kept and stays visible to Admins."
            : 'It will be removed from match lists. The record is kept and stays visible to Admins.',
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
