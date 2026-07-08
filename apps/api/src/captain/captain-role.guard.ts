import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthErrorCode, UserRole } from '@acc/types';

import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';

/** Allows platform Captain / Vice-Captain roles or a scoped team leadership assignment. */
@Injectable()
export class CaptainRoleGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (
      request.user.role === UserRole.Captain ||
      request.user.role === UserRole.ViceCaptain
    ) {
      return true;
    }

    const assignment = await this.prisma.roleAssignment.findFirst({
      where: {
        userId: request.user.id,
        role: { in: [UserRole.Captain, UserRole.ViceCaptain] },
      },
      select: { id: true },
    });

    if (!assignment) {
      throw new ForbiddenException({
        message: 'Captain or Vice-Captain access required',
        error: AuthErrorCode.Forbidden,
      });
    }

    return true;
  }
}
