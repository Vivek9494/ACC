import {
  type AssignTeamRolesResponse,
  type AuthUser,
  Permission,
  type AddTeamPlayersResponse,
  type TeamAddPlayersPickerView,
  type TeamDetailView,
  type TeamRoleCandidatesView,
  type TeamSummary,
  type TournamentPlayerProfileView,
  type UploadTeamLogoResponse,
} from '@acc/types';
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
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { AuthService } from '../auth/auth.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';
import { PermissionGuard } from '../authz/permission.guard';
import { RequirePermission } from '../authz/require-permission.decorator';
import { MediaUploadCompleteDto, MediaUploadSessionDto } from '../media/dto/media-upload.dto';
import { MediaUploadService } from '../media/media-upload.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { AddTeamPlayersDto } from './dto/add-team-players.dto';
import { AssignTeamRolesDto } from './dto/assign-team-roles.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { TeamsService } from './teams.service';

/** Tournament team management (§6.3). */
@Controller()
@UseGuards(JwtAuthGuard)
export class TeamsController {
  constructor(
    private readonly teams: TeamsService,
    private readonly auth: AuthService,
    private readonly mediaUpload: MediaUploadService,
  ) {}

  @Get('tournaments/:tournamentId/teams')
  @Public()
  list(@Param('tournamentId') tournamentId: string): Promise<TeamSummary[]> {
    return this.teams.list(tournamentId);
  }

  @Get('tournaments/:tournamentId/teams/role-candidates')
  @RequirePermission(Permission.ASSIGN_TEAM_ROLES)
  @UseGuards(PermissionGuard)
  listRoleCandidates(
    @CurrentUser() user: AuthUser,
    @Param('tournamentId') tournamentId: string,
  ): Promise<TeamRoleCandidatesView> {
    return this.teams.listRoleCandidates(user, tournamentId);
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

  @Patch('tournaments/:tournamentId/teams/:teamId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('tournamentId') tournamentId: string,
    @Param('teamId') teamId: string,
    @Body() dto: UpdateTeamDto,
  ): Promise<TeamSummary> {
    return this.teams.update(user, tournamentId, teamId, dto);
  }

  @Delete('tournaments/:tournamentId/teams/:teamId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('tournamentId') tournamentId: string,
    @Param('teamId') teamId: string,
  ): Promise<void> {
    return this.teams.remove(user, tournamentId, teamId);
  }

  @Get('tournaments/:tournamentId/teams/:teamId/add-player-candidates')
  listAddPlayerCandidates(
    @CurrentUser() user: AuthUser,
    @Param('tournamentId') tournamentId: string,
    @Param('teamId') teamId: string,
  ): Promise<TeamAddPlayersPickerView> {
    return this.teams.listAddPlayerCandidates(user, tournamentId, teamId);
  }

  @Post('tournaments/:tournamentId/teams/:teamId/players')
  addPlayers(
    @CurrentUser() user: AuthUser,
    @Param('tournamentId') tournamentId: string,
    @Param('teamId') teamId: string,
    @Body() dto: AddTeamPlayersDto,
  ): Promise<AddTeamPlayersResponse> {
    return this.teams.addPlayersToTeam(user, tournamentId, teamId, dto);
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

  @Post('tournaments/team-logo/upload-session')
  createLogoUploadSession(
    @CurrentUser() user: AuthUser,
    @Body() dto: MediaUploadSessionDto,
  ) {
    return this.mediaUpload.createTeamLogoUploadSession(user.id, dto);
  }

  @Post('tournaments/team-logo/complete')
  async completeLogoUpload(
    @CurrentUser() user: AuthUser,
    @Body() dto: MediaUploadCompleteDto,
  ): Promise<UploadTeamLogoResponse> {
    const result = await this.mediaUpload.completeTeamLogoUpload(user.id, dto);
    return {
      storageKey: result.storageKey,
      logoUrl: result.displayUrl,
    };
  }
}
