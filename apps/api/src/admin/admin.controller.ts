import type { AdminOverview } from '@acc/types';
import { Permission } from '@acc/types';
import { Controller, Get, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../authz/permission.guard';
import { RequirePermission } from '../authz/require-permission.decorator';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview')
  @UseGuards(PermissionGuard)
  @RequirePermission(Permission.VIEW_ADMIN_OVERVIEW)
  overview(): Promise<AdminOverview> {
    return this.admin.getOverview();
  }
}
