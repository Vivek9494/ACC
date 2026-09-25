import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthErrorCode, UserRole } from '@acc/types';

import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

/** Allows plain Player role users without Captain / Vice-Captain assignments. */
@Injectable()
export class PlayerRoleGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = await this.prisma.user.findUnique({
      where: { id: request.user.id },
      select: { role: true },
    });

    if (user?.role !== UserRole.Player) {
      throw new ForbiddenException({
        message: 'Player access required',
        error: AuthErrorCode.Forbidden,
      });
    }

    const leadership = await this.prisma.roleAssignment.findFirst({
      where: {
        userId: request.user.id,
        role: { in: [UserRole.Captain, UserRole.ViceCaptain] },
      },
      select: { id: true },
    });

    if (leadership) {
      throw new ForbiddenException({
        message: 'Use the Captain dashboard for team leadership accounts',
        error: AuthErrorCode.Forbidden,
      });
    }

    return true;
  }
}
