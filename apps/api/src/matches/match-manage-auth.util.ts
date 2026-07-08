import {
  isUpcomingMatchForScheduleManagement,
  type AuthUser,
  type MatchState,
  Permission,
} from '@acc/types';
import { ForbiddenException } from '@nestjs/common';

import type { PermissionService } from '../authz/permission.service';

/** Server gate for editing or soft-deleting an upcoming fixture (Admin / Club Manager). */
export async function assertCanManageUpcomingMatch(
  permissions: PermissionService,
  actor: AuthUser,
  match: { id: string; tournamentId: string; state: MatchState },
  permission: typeof Permission.EDIT_MATCH | typeof Permission.DELETE_MATCH,
): Promise<void> {
  if (!isUpcomingMatchForScheduleManagement(match.state)) {
    throw new ForbiddenException({
      message:
        permission === Permission.DELETE_MATCH
          ? 'Only upcoming matches can be deleted'
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
