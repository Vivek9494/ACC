import {
  type AuthUser,
  type SetRegistrationFavouriteResponse,
  type TournamentFavouritePlayersView,
} from '@acc/types';
import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SetRegistrationFavouriteDto } from './dto/set-registration-favourite.dto';
import { RegistrationsService } from './registrations.service';

/**
 * Per-team tournament favourites shortlist (Captain + Vice-Captain + Manager).
 * Authz is enforced in the service with a concrete teamId (OwnTeam scope).
 */
@Controller('tournaments/:tournamentId/favourite-players')
@UseGuards(JwtAuthGuard)
export class FavouritePlayersController {
  constructor(private readonly registrations: RegistrationsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Param('tournamentId') tournamentId: string,
  ): Promise<TournamentFavouritePlayersView> {
    return this.registrations.listFavouritePlayers(user, tournamentId);
  }

  @Put(':userId')
  setFavourite(
    @CurrentUser() user: AuthUser,
    @Param('tournamentId') tournamentId: string,
    @Param('userId') userId: string,
    @Body() dto: SetRegistrationFavouriteDto,
  ): Promise<SetRegistrationFavouriteResponse> {
    return this.registrations.setRegistrationFavourite(
      user,
      tournamentId,
      userId,
      dto.favourited,
    );
  }
}
