import {
  type AuthUser,
  Permission,
  type GroupSummary,
} from '@acc/types';
import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';
import { PermissionGuard } from '../authz/permission.guard';
import { RequirePermission } from '../authz/require-permission.decorator';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupMembersDto } from './dto/update-group-members.dto';
import { GroupsService } from './groups.service';

/** Tournament group management (Group Stage + Knockout). */
@Controller()
@UseGuards(JwtAuthGuard)
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Get('tournaments/:tournamentId/groups')
  @Public()
  list(@Param('tournamentId') tournamentId: string): Promise<GroupSummary[]> {
    return this.groups.list(tournamentId);
  }

  @Post('tournaments/:tournamentId/groups')
  @RequirePermission(Permission.CREATE_MATCH)
  @UseGuards(PermissionGuard)
  create(
    @CurrentUser() user: AuthUser,
    @Param('tournamentId') tournamentId: string,
    @Body() dto: CreateGroupDto,
  ): Promise<GroupSummary> {
    return this.groups.create(user, tournamentId, dto);
  }

  @Patch('tournaments/:tournamentId/groups/:groupId')
  @RequirePermission(Permission.CREATE_MATCH)
  @UseGuards(PermissionGuard)
  updateMembers(
    @CurrentUser() user: AuthUser,
    @Param('tournamentId') tournamentId: string,
    @Param('groupId') groupId: string,
    @Body() dto: UpdateGroupMembersDto,
  ): Promise<GroupSummary> {
    return this.groups.updateMembers(user, tournamentId, groupId, dto);
  }

  @Delete('tournaments/:tournamentId/groups/:groupId')
  @RequirePermission(Permission.CREATE_MATCH)
  @UseGuards(PermissionGuard)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('tournamentId') tournamentId: string,
    @Param('groupId') groupId: string,
  ): Promise<void> {
    return this.groups.remove(user, tournamentId, groupId);
  }
}
