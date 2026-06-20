import {
  type AssignTeamRolesResponse,
  type AuthUser,
  Permission,
  TEAM_LOGO_MAX_BYTES,
  type TeamDetailView,
  type TeamSummary,
  type TournamentPlayerProfileView,
  type UploadTeamLogoResponse,
} from '@acc/types';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';

import { AuthService } from '../auth/auth.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';
import { PermissionGuard } from '../authz/permission.guard';
import { RequirePermission } from '../authz/require-permission.decorator';
import { CreateTeamDto } from './dto/create-team.dto';
import { AssignTeamRolesDto } from './dto/assign-team-roles.dto';
import { TeamsService } from './teams.service';

/** Tournament team management (§6.3). */
@Controller()
@UseGuards(JwtAuthGuard)
export class TeamsController {
  constructor(
    private readonly teams: TeamsService,
    private readonly auth: AuthService,
  ) {}

  @Get('tournaments/:tournamentId/teams')
  @Public()
  list(@Param('tournamentId') tournamentId: string): Promise<TeamSummary[]> {
    return this.teams.list(tournamentId);
  }

  @Get('tournaments/:tournamentId/teams/:teamId')
  @Public()
  async detail(
    @Param('tournamentId') tournamentId: string,
    @Param('teamId') teamId: string,
    @Req() req: Request,
  ): Promise<TeamDetailView> {
    const viewer = await this.auth.resolveOptionalUser(req);
    return this.teams.getDetail(tournamentId, teamId, viewer);
  }

  @Get('tournaments/:tournamentId/players/:userId')
  @RequirePermission(Permission.VIEW_TOURNAMENT_PLAYER_PROFILE)
  @UseGuards(PermissionGuard)
  playerProfile(
    @CurrentUser() user: AuthUser,
    @Param('tournamentId') tournamentId: string,
    @Param('userId') userId: string,
  ): Promise<TournamentPlayerProfileView> {
    return this.teams.getPlayerProfile(user, tournamentId, userId);
  }

  @Post('tournaments/:tournamentId/teams')
  @RequirePermission(Permission.EDIT_TOURNAMENT)
  @UseGuards(PermissionGuard)
  create(
    @CurrentUser() user: AuthUser,
    @Param('tournamentId') tournamentId: string,
    @Body() dto: CreateTeamDto,
  ): Promise<TeamSummary> {
    return this.teams.create(user, tournamentId, dto);
  }

  @Patch('tournaments/:tournamentId/teams/:teamId/roles')
  @RequirePermission(Permission.ASSIGN_TEAM_ROLES)
  @UseGuards(PermissionGuard)
  assignRoles(
    @CurrentUser() user: AuthUser,
    @Param('tournamentId') tournamentId: string,
    @Param('teamId') teamId: string,
    @Body() dto: AssignTeamRolesDto,
  ): Promise<AssignTeamRolesResponse> {
    return this.teams.assignTeamRoles(user, tournamentId, teamId, dto);
  }

  @Post('tournaments/team-logo')
  @UseInterceptors(FileInterceptor('logo', { limits: { fileSize: TEAM_LOGO_MAX_BYTES } }))
  async uploadLogo(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: { buffer: Buffer } | undefined,
  ): Promise<UploadTeamLogoResponse> {
    if (!file?.buffer?.length) {
      throw new BadRequestException({
        message: 'Team logo file is required',
        error: 'LOGO_REQUIRED',
      });
    }
    const logoUrl = await this.teams.uploadLogo(user, file.buffer);
    return { logoUrl };
  }
}
