import type {
  AdminOverview,
  AdminUserDetail,
  AdminUserPlayerStatsView,
  AdminUsersPage,
  AuthUser,
  CreateAdminUserResponse,
  GenerateTemporaryPasswordResponse,
  TodayBirthdayUserSummary,
  BirthdayUserSummary,
  UpdateAdminUserStatusResponse,
} from '@acc/types';
import { Permission } from '@acc/types';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../authz/permission.guard';
import { RequirePermission } from '../authz/require-permission.decorator';
import { AdminService } from './admin.service';
import { GetAdminUserStatsDto } from './dto/get-admin-user-stats.dto';
import { ListAdminUsersDto } from './dto/list-admin-users.dto';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { UpdateAdminUserStatusDto } from './dto/update-admin-user-status.dto';

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

  @Post('users')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(PermissionGuard)
  @RequirePermission(Permission.MANAGE_ADMIN_USERS)
  createUser(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateAdminUserDto,
  ): Promise<CreateAdminUserResponse> {
    return this.admin.createUser(user, dto);
  }

  @Get('users')
  @UseGuards(PermissionGuard)
  @RequirePermission(Permission.VIEW_ADMIN_USERS)
  listUsers(
    @CurrentUser() user: AuthUser,
    @Query() query: ListAdminUsersDto,
  ): Promise<AdminUsersPage> {
    return this.admin.listUsers(user, query);
  }

  @Get('birthdays/today')
  @UseGuards(PermissionGuard)
  @RequirePermission(Permission.VIEW_ADMIN_USERS)
  listTodayBirthdays(): Promise<BirthdayUserSummary[]> {
    return this.admin.listBirthdayDirectory();
  }

  @Get('users/:userId')
  @UseGuards(PermissionGuard)
  @RequirePermission(Permission.VIEW_ADMIN_USERS)
  getUser(@Param('userId') userId: string): Promise<AdminUserDetail> {
    return this.admin.getUser(userId);
  }

  @Get('users/:userId/stats')
  @UseGuards(PermissionGuard)
  @RequirePermission(Permission.VIEW_ADMIN_USERS)
  getUserStats(
    @Param('userId') userId: string,
    @Query() query: GetAdminUserStatsDto,
  ): Promise<AdminUserPlayerStatsView> {
    return this.admin.getUserStats(userId, query.ballType);
  }

  @Patch('users/:userId')
  @UseGuards(PermissionGuard)
  @RequirePermission(Permission.MANAGE_ADMIN_USERS)
  updateUser(
    @CurrentUser() user: AuthUser,
    @Param('userId') userId: string,
    @Body() dto: UpdateAdminUserDto,
  ): Promise<AdminUserDetail> {
    return this.admin.updateUser(user, userId, dto);
  }

  @Patch('users/:userId/status')
  @UseGuards(PermissionGuard)
  @RequirePermission(Permission.MANAGE_ADMIN_USERS)
  setUserStatus(
    @CurrentUser() user: AuthUser,
    @Param('userId') userId: string,
    @Body() dto: UpdateAdminUserStatusDto,
  ): Promise<UpdateAdminUserStatusResponse> {
    return this.admin.setUserStatus(user, userId, dto.isActive);
  }

  @Delete('users/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(PermissionGuard)
  @RequirePermission(Permission.MANAGE_ADMIN_USERS)
  async removeUser(@CurrentUser() user: AuthUser, @Param('userId') userId: string): Promise<void> {
    await this.admin.softDeleteUser(user, userId);
  }

  @Post('users/:userId/temporary-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PermissionGuard)
  @RequirePermission(Permission.MANAGE_ADMIN_USERS)
  generateTemporaryPassword(
    @CurrentUser() user: AuthUser,
    @Param('userId') userId: string,
  ): Promise<GenerateTemporaryPasswordResponse> {
    return this.admin.generateTemporaryPassword(user, userId);
  }
}
