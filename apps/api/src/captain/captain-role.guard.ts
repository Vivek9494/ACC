import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthErrorCode, UserRole } from '@acc/types';

import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';

/** Allows only users with a scoped Captain or Vice-Captain RoleAssignment. */
@Injectable()
export class CaptainRoleGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
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
