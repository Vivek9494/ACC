import { AuthErrorCode, type Permission } from '@acc/types';
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { PermissionService, type PermissionRefs } from './permission.service';
import { REQUIRE_PERMISSION_KEY } from './require-permission.decorator';

/**
 * Authorizes a route against the permission declared with
 * `@RequirePermission(...)`. Runs after `JwtAuthGuard` (which populates
 * `request.user`) and resolves the tournament/team/center scope from the
 * request before consulting the RBAC matrix via {@link PermissionService}.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Permission | undefined>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) {
      throw new UnauthorizedException({
        message: 'Authentication required',
        error: AuthErrorCode.InvalidCredentials,
      });
    }

    const allowed = await this.permissions.check(required, request.user, this.extractRefs(request));
    if (!allowed) {
      throw new ForbiddenException({
        message: 'You do not have permission to perform this action',
        error: AuthErrorCode.Forbidden,
      });
    }
    return true;
  }

  /** Reads scope references from route params, then body, then query. */
  private extractRefs(request: AuthenticatedRequest): PermissionRefs {
    const params = (request.params ?? {}) as Record<string, unknown>;
    const body = (request.body ?? {}) as Record<string, unknown>;
    const query = (request.query ?? {}) as Record<string, unknown>;

    const pick = (key: string): string | undefined => {
      const value = params[key] ?? body[key] ?? query[key];
      return typeof value === 'string' ? value : undefined;
    };

    return {
      tournamentId: pick('tournamentId'),
      teamId: pick('teamId'),
      matchId: pick('matchId'),
      registrationId: pick('registrationId'),
      targetUserId: pick('targetUserId') ?? pick('userId'),
      targetCenterId: pick('targetCenterId') ?? pick('centerId'),
    };
  }
}
