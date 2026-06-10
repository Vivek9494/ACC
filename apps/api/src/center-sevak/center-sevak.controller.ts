import type { CenterSevakDashboard } from '@acc/types';
import { Permission } from '@acc/types';
import { Controller, Get, Req, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../authz/permission.guard';
import { RequirePermission } from '../authz/require-permission.decorator';
import { CenterSevakService } from './center-sevak.service';

@Controller('center-sevak')
@UseGuards(JwtAuthGuard)
export class CenterSevakController {
  constructor(private readonly centerSevak: CenterSevakService) {}

  @Get('dashboard')
  @UseGuards(PermissionGuard)
  @RequirePermission(Permission.VIEW_CENTER_SEVAK_DASHBOARD)
  dashboard(@Req() req: AuthenticatedRequest): Promise<CenterSevakDashboard> {
    return this.centerSevak.getDashboard(req.user.id, req.user);
  }
}
