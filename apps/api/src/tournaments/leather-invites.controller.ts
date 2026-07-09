import {
  type AuthUser,
  type CreateLeatherInvitesResponse,
  type LeatherInviteCandidatesResponse,
  type LeatherTournamentInvitesResponse,
  UserRole,
} from '@acc/types';
import {
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateLeatherInvitesDto } from './dto/create-leather-invites.dto';
import { LeatherTournamentVisibilityService } from './leather-tournament-visibility.service';

@Controller('tournaments/:tournamentId/leather-invites')
@UseGuards(JwtAuthGuard)
export class LeatherInvitesController {
  constructor(private readonly leatherVisibility: LeatherTournamentVisibilityService) {}

  @Get('candidates')
  listCandidates(
    @CurrentUser() user: AuthUser,
    @Param('tournamentId') tournamentId: string,
    @Query('q') search?: string,
  ): Promise<LeatherInviteCandidatesResponse> {
    this.assertClubManager(user);
    return this.leatherVisibility
      .listInviteCandidates(tournamentId, search)
      .then((candidates) => ({ candidates }));
  }

  @Get()
  listInvites(
    @CurrentUser() user: AuthUser,
    @Param('tournamentId') tournamentId: string,
  ): Promise<LeatherTournamentInvitesResponse> {
    this.assertClubManager(user);
    return this.leatherVisibility.listInvites(tournamentId).then((invites) => ({ invites }));
  }

  @Post()
  createInvites(
    @CurrentUser() user: AuthUser,
    @Param('tournamentId') tournamentId: string,
    @Body() body: CreateLeatherInvitesDto,
  ): Promise<CreateLeatherInvitesResponse> {
    this.assertClubManager(user);
    return this.leatherVisibility
      .createInvites(user, tournamentId, body.userIds)
      .then((invitedCount) => ({ invitedCount }));
  }

  @Delete(':userId')
  revokeInvite(
    @CurrentUser() user: AuthUser,
    @Param('tournamentId') tournamentId: string,
    @Param('userId') userId: string,
  ): Promise<void> {
    this.assertClubManager(user);
    return this.leatherVisibility.revokeInvite(user, tournamentId, userId);
  }

  private assertClubManager(user: AuthUser): void {
    if (user.role !== UserRole.ClubManager) {
      throw new ForbiddenException({
        message: 'Only Club Managers may manage leather invites',
        error: 'FORBIDDEN',
      });
    }
  }
}
