import {
  type AuthUser,
  type CloneSuggestion,
  Permission,
  type TournamentBrowseEntry,
  type TournamentDashboardEntry,
  type TournamentDetail,
  type TournamentEditFormData,
  type TournamentSummary,
} from '@acc/types';
import {
  Body,
  Controller,
  Delete,
  Get,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { type UploadTournamentPosterResponse } from '@acc/types';

import { CurrentUser } from '../auth/current-user.decorator';
import { AuthService } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';
import { PermissionGuard } from '../authz/permission.guard';
import { RequirePermission } from '../authz/require-permission.decorator';
import { MediaUploadCompleteDto, MediaUploadSessionDto } from '../media/dto/media-upload.dto';
import { MediaUploadService } from '../media/media-upload.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { SelectMatchSchedulingFormatDto } from './dto/select-match-scheduling-format.dto';
import { TransitionStateDto } from './dto/transition-state.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { TournamentsService } from './tournaments.service';

@Controller('tournaments')
@UseGuards(JwtAuthGuard)
export class TournamentsController {
  constructor(
    private readonly tournaments: TournamentsService,
    private readonly auth: AuthService,
    private readonly mediaUpload: MediaUploadService,
  ) {}

  /** Create a tournament (§6.1). Type + RBAC are resolved in the service. */
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTournamentDto,
  ): Promise<TournamentDetail> {
    return this.tournaments.create(user, dto);
  }

  @Post('poster/upload-session')
  createPosterUploadSession(
    @CurrentUser() user: AuthUser,
    @Body() dto: MediaUploadSessionDto,
  ) {
    return this.mediaUpload.createTournamentPosterUploadSession(user.id, dto);
  }

  @Post('poster/complete')
  async completePosterUpload(
    @CurrentUser() user: AuthUser,
    @Body() dto: MediaUploadCompleteDto,
  ): Promise<UploadTournamentPosterResponse> {
    const result = await this.mediaUpload.completeTournamentPosterUpload(user.id, dto);
    return {
      storageKey: result.storageKey,
      posterUrl: result.displayUrl,
    };
  }

  @Get()
  @Public()
  async list(@Req() req: Request): Promise<TournamentSummary[]> {
    const viewer = await this.auth.resolveOptionalUser(req);
    return this.tournaments.list(viewer);
  }

  /** Clone suggestion by name (§6.2). Declared before the :tournamentId route. */
  @Get('clone-suggestion')
  cloneSuggestion(@Query('name') name: string): Promise<CloneSuggestion | null> {
    return this.tournaments.cloneSuggestion(name ?? '');
  }

  /** Tournament rows with per-record permissions for dashboard menus. */
  @Get('dashboard-entries')
  listDashboardEntries(@CurrentUser() user: AuthUser): Promise<TournamentDashboardEntry[]> {
    return this.tournaments.listDashboardEntries(user);
  }

  /** Authenticated browse tab — tennis center scope + leather access filter. */
  @Get('browse')
  listBrowseEntries(@CurrentUser() user: AuthUser): Promise<TournamentBrowseEntry[]> {
    return this.tournaments.listBrowseEntries(user);
  }

  @Get(':tournamentId/edit-form')
  @RequirePermission(Permission.EDIT_TOURNAMENT)
  @UseGuards(PermissionGuard)
  getEditForm(
    @CurrentUser() user: AuthUser,
    @Param('tournamentId') tournamentId: string,
  ): Promise<TournamentEditFormData> {
    return this.tournaments.getEditForm(user, tournamentId);
  }

  @Get(':tournamentId')
  @Public()
  async detail(
    @Param('tournamentId') tournamentId: string,
    @Req() req: Request,
  ): Promise<TournamentDetail> {
    const viewer = await this.auth.resolveOptionalUser(req);
    return this.tournaments.getDetail(tournamentId, viewer);
  }

  /** Mid-tournament edits (§6.4). Organizer/Admin only (B1). */
  @Patch(':tournamentId')
  @RequirePermission(Permission.EDIT_TOURNAMENT)
  @UseGuards(PermissionGuard)
  update(
    @CurrentUser() user: AuthUser,
    @Param('tournamentId') tournamentId: string,
    @Body() dto: UpdateTournamentDto,
  ): Promise<TournamentDetail> {
    return this.tournaments.update(user, tournamentId, dto);
  }

  /** Records the scheduling mode chosen in the Schedule Matches modal. */
  @Post(':tournamentId/match-scheduling-format')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Permission.CREATE_MATCH)
  @UseGuards(PermissionGuard)
  selectMatchSchedulingFormat(
    @CurrentUser() user: AuthUser,
    @Param('tournamentId') tournamentId: string,
    @Body() dto: SelectMatchSchedulingFormatDto,
  ): Promise<TournamentDetail> {
    return this.tournaments.selectMatchSchedulingFormat(user, tournamentId, dto.schedulingFormat);
  }

  /** Lifecycle transition (§5.1). */
  @Post(':tournamentId/state')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Permission.CHANGE_TOURNAMENT_STATUS)
  @UseGuards(PermissionGuard)
  transition(
    @Param('tournamentId') tournamentId: string,
    @Body() dto: TransitionStateDto,
  ): Promise<TournamentDetail> {
    return this.tournaments.transition(tournamentId, dto.state);
  }

  @Delete(':tournamentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(Permission.EDIT_TOURNAMENT)
  @UseGuards(PermissionGuard)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('tournamentId') tournamentId: string,
  ): Promise<void> {
    await this.tournaments.remove(user, tournamentId);
  }
}
