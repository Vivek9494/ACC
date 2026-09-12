import {
  isDeletableMatchState,
  isUpcomingMatchForScheduleManagement,
  type AuthUser,
  type MatchState,
  Permission,
} from '@acc/types';
import { ForbiddenException } from '@nestjs/common';

import type { PermissionService } from '../authz/permission.service';

/**
 * Server gate for editing or soft-deleting a fixture (Admin / Club Manager).
 *
 * Edit stays restricted to upcoming fixtures. Delete also allows finished results
 * (Completed / No Result); knockout fixtures are never deletable because the
 * bracket has already progressed downstream.
 */
export async function assertCanManageUpcomingMatch(
  permissions: PermissionService,
  actor: AuthUser,
  match: { id: string; tournamentId: string; state: MatchState; bracketId?: string | null },
  permission: typeof Permission.EDIT_MATCH | typeof Permission.DELETE_MATCH,
): Promise<void> {
  const isDelete = permission === Permission.DELETE_MATCH;

  if (isDelete && match.bracketId != null) {
    throw new ForbiddenException({
      message: "Knockout matches can't be deleted",
      error: 'KNOCKOUT_MATCH_NOT_DELETABLE',
    });
  }

  const stateAllowed = isDelete
    ? isDeletableMatchState(match.state)
    : isUpcomingMatchForScheduleManagement(match.state);

  if (!stateAllowed) {
    throw new ForbiddenException({
      message: isDelete
        ? 'Only upcoming, completed, or no-result matches can be deleted'
        : 'Only upcoming matches can be edited',
      error: 'FORBIDDEN',
    });
  }

  const allowed = await permissions.check(permission, actor, {
    tournamentId: match.tournamentId,
    matchId: match.id,
  });
  if (!allowed) {
    throw new ForbiddenException({
      message: 'You do not have permission to perform this action',
      error: 'FORBIDDEN',
    });
  }
}
