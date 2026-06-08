import type { Permission } from '@acc/types';
import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISSION_KEY = 'require_permission';

/**
 * Declares the RBAC permission a route requires, enforced by
 * {@link PermissionGuard}. The guard reads scope references (tournamentId,
 * teamId, matchId, registrationId, targetUserId, centerId) from the request
 * params/body/query.
 *
 * @example
 * `@RequirePermission('CONFIRM_SCORECARD')`
 */
export const RequirePermission = (permission: Permission): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permission);
