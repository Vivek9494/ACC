import type { ClubManagerDashboard } from '@acc/types';
import { Permission } from '@acc/types';
import { Controller, Get, Req, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../authz/permission.guard';
import { RequirePermission } from '../authz/require-permission.decorator';
import { ClubManagerService } from './club-manager.service';

@Controller('club-manager')
@UseGuards(JwtAuthGuard)
export class ClubManagerController {
  constructor(private readonly clubManager: ClubManagerService) {}

  @Get('dashboard')
  @UseGuards(PermissionGuard)
  @RequirePermission(Permission.VIEW_CLUB_MANAGER_DASHBOARD)
  dashboard(@Req() req: AuthenticatedRequest): Promise<ClubManagerDashboard> {
    return this.clubManager.getDashboard(req.user.id);
  }
}
