import type { AdminAppSettings, AuthUser, UploadLimits } from '@acc/types';
import { Permission } from '@acc/types';
import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';
import { PermissionGuard } from '../authz/permission.guard';
import { RequirePermission } from '../authz/require-permission.decorator';
import { AppSettingsService } from './app-settings.service';
import { UpdateAdminAppSettingsDto } from './dto/update-admin-app-settings.dto';

@Controller()
export class AppSettingsController {
  constructor(private readonly settings: AppSettingsService) {}

  /** Public read of upload limits — used by all clients before upload. */
  @Get('settings/upload-limits')
  @Public()
  getUploadLimits(): Promise<UploadLimits> {
    return this.settings.getUploadLimits();
  }

  @Get('admin/settings')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission(Permission.MANAGE_ADMIN_SETTINGS)
  getAdminSettings(): Promise<AdminAppSettings> {
    return this.settings.getAdminSettings();
  }

  @Patch('admin/settings')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission(Permission.MANAGE_ADMIN_SETTINGS)
  updateAdminSettings(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateAdminAppSettingsDto,
  ): Promise<AdminAppSettings> {
    return this.settings.updateAdminSettings(user, dto);
  }
}
