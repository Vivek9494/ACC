import { AuthErrorCode, type AuthUser } from '@acc/types';
import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

import { PrismaService } from '../prisma/prisma.service';
import { ALLOW_MUST_CHANGE_PASSWORD_KEY } from './allow-must-change-password.decorator';
import { IS_PUBLIC_KEY } from './public.decorator';
import { toAuthUser } from './auth.service';
import type { AccessTokenPayload } from './auth.constants';

/** Request augmented with the authenticated user once the guard passes. */
export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}

/**
 * Verifies the Bearer access token and enforces single-device login (§3.2):
 * the token's embedded `tokenVersion` must equal the user's current value, so
 * a token from a superseded session is rejected — silently logging out the
 * previous device.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearer(request);
    if (!token) {
      throw new UnauthorizedException({
        message: 'Authentication required',
        error: AuthErrorCode.InvalidCredentials,
      });
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new UnauthorizedException({
        message: 'Access token is invalid or expired',
        error: AuthErrorCode.InvalidCredentials,
      });
    }

    if (payload.type !== 'access') {
      throw new UnauthorizedException({
        message: 'Access token is invalid or expired',
        error: AuthErrorCode.InvalidCredentials,
      });
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive || user.deletedAt || user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException({
        message: 'Session is no longer valid',
        error: AuthErrorCode.TokenVersionMismatch,
      });
    }

    const allowMustChangePassword = this.reflector.getAllAndOverride<boolean>(
      ALLOW_MUST_CHANGE_PASSWORD_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (user.mustChangePassword && !allowMustChangePassword) {
      throw new UnauthorizedException({
        message: 'You must set a new password before continuing',
        error: AuthErrorCode.MustChangePassword,
      });
    }

    request.user = toAuthUser(user);
    return true;
  }

  private extractBearer(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header) {
      return null;
    }
    const [scheme, value] = header.split(' ');
    return scheme === 'Bearer' && value ? value : null;
  }
}
