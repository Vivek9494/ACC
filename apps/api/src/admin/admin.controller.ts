import type { AdminOverview, AdminUserDetail, AdminUsersPage } from '@acc/types';
import { Permission } from '@acc/types';
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../authz/permission.guard';
import { RequirePermission } from '../authz/require-permission.decorator';
import { AdminService } from './admin.service';
import { ListAdminUsersDto } from './dto/list-admin-users.dto';

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

  @Get('users')
  @UseGuards(PermissionGuard)
  @RequirePermission(Permission.VIEW_ADMIN_USERS)
  listUsers(@Query() query: ListAdminUsersDto): Promise<AdminUsersPage> {
    return this.admin.listUsers(query);
  }

  @Get('users/:userId')
  @UseGuards(PermissionGuard)
  @RequirePermission(Permission.VIEW_ADMIN_USERS)
  getUser(@Param('userId') userId: string): Promise<AdminUserDetail> {
    return this.admin.getUser(userId);
  }
}
