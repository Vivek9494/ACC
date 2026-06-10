import {
  type AuthUser,
  type CloneSuggestion,
  Permission,
  type TournamentDetail,
  type TournamentSummary,
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
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';
import { PermissionGuard } from '../authz/permission.guard';
import { RequirePermission } from '../authz/require-permission.decorator';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { TransitionStateDto } from './dto/transition-state.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { TournamentsService } from './tournaments.service';

@Controller('tournaments')
@UseGuards(JwtAuthGuard)
export class TournamentsController {
  constructor(private readonly tournaments: TournamentsService) {}

  /** Create a tournament (§6.1). Type + RBAC are resolved in the service. */
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTournamentDto,
  ): Promise<TournamentDetail> {
    return this.tournaments.create(user, dto);
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

  @Get(':tournamentId')
  @Public()
  detail(@Param('tournamentId') tournamentId: string): Promise<TournamentDetail> {
    return this.tournaments.getDetail(tournamentId);
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
