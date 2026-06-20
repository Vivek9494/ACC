import {
  type AuthUser,
  type CloneSuggestion,
  Permission,
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
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { TOURNAMENT_FORM_MESSAGES, TOURNAMENT_POSTER_MAX_BYTES, type UploadTournamentPosterResponse } from '@acc/types';

import { CurrentUser } from '../auth/current-user.decorator';
import { AuthService } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';
import { PermissionGuard } from '../authz/permission.guard';
import { RequirePermission } from '../authz/require-permission.decorator';
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
  ) {}

  /** Create a tournament (§6.1). Type + RBAC are resolved in the service. */
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTournamentDto,
  ): Promise<TournamentDetail> {
    return this.tournaments.create(user, dto);
  }

  @Post('poster')
  @UseInterceptors(
    FileInterceptor('poster', { limits: { fileSize: TOURNAMENT_POSTER_MAX_BYTES } }),
  )
  async uploadPoster(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: { buffer: Buffer } | undefined,
  ): Promise<UploadTournamentPosterResponse> {
    if (!file?.buffer?.length) {
      throw new BadRequestException({
        message: TOURNAMENT_FORM_MESSAGES.poster.required,
        error: 'POSTER_REQUIRED',
        fields: { poster: TOURNAMENT_FORM_MESSAGES.poster.required },
      });
    }
    const posterUrl = await this.tournaments.uploadPoster(user, file.buffer);
    return { posterUrl };
  }

  @Get()
  @Public()
  list(): Promise<TournamentSummary[]> {
    return this.tournaments.list();
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
