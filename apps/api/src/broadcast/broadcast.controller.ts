import type { ActiveBroadcast, AdminBroadcastView, AuthUser, BroadcastHistoryEntry } from '@acc/types';
import { Permission } from '@acc/types';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../authz/permission.guard';
import { RequirePermission } from '../authz/require-permission.decorator';
import { MediaUploadCompleteDto, MediaUploadSessionDto } from '../media/dto/media-upload.dto';
import { MediaUploadService } from '../media/media-upload.service';
import { BroadcastService } from './broadcast.service';
import { CreateBroadcastDto } from './dto/create-broadcast.dto';

@Controller()
export class BroadcastController {
  constructor(
    private readonly broadcast: BroadcastService,
    private readonly mediaUpload: MediaUploadService,
  ) {}

  /** Current active broadcast for any signed-in user (server decides expiry). */
  @Get('broadcast/active')
  @UseGuards(JwtAuthGuard)
  getActiveBroadcast(): Promise<ActiveBroadcast | null> {
    return this.broadcast.getActiveBroadcast();
  }

  /** Admin + Club Manager — see Permission.MANAGE_BROADCAST. */
  @Get('admin/broadcast')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission(Permission.MANAGE_BROADCAST)
  getAdminBroadcast(): Promise<AdminBroadcastView | null> {
    return this.broadcast.getAdminBroadcast();
  }

  @Get('admin/broadcast/history')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission(Permission.MANAGE_BROADCAST)
  listBroadcastHistory(): Promise<BroadcastHistoryEntry[]> {
    return this.broadcast.listBroadcastHistory();
  }

  @Post('admin/broadcast/image/upload-session')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission(Permission.MANAGE_BROADCAST)
  createBroadcastImageUploadSession(
    @CurrentUser() user: AuthUser,
    @Body() dto: MediaUploadSessionDto,
  ) {
    return this.mediaUpload.createBroadcastImageUploadSession(user.id, dto);
  }

  @Post('admin/broadcast/image/complete')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission(Permission.MANAGE_BROADCAST)
  completeBroadcastImageUpload(
    @CurrentUser() user: AuthUser,
    @Body() dto: MediaUploadCompleteDto,
  ) {
    return this.mediaUpload.completeBroadcastImageUpload(user.id, dto);
  }

  @Post('admin/broadcast')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission(Permission.MANAGE_BROADCAST)
  postBroadcast(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateBroadcastDto,
  ): Promise<ActiveBroadcast> {
    return this.broadcast.createBroadcast(user, dto.text, dto.imageStorageKey);
  }

  @Delete('admin/broadcast/active')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission(Permission.MANAGE_BROADCAST)
  async removeActiveBroadcast(@CurrentUser() user: AuthUser): Promise<void> {
    await this.broadcast.removeActiveBroadcast(user);
  }
}
