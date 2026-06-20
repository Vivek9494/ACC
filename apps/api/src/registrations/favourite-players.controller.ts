import {
  type AuthUser,
  Permission,
  type SetRegistrationFavouriteResponse,
  type TournamentFavouritePlayersView,
} from '@acc/types';
import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../authz/permission.guard';
import { RequirePermission } from '../authz/require-permission.decorator';
import { SetRegistrationFavouriteDto } from './dto/set-registration-favourite.dto';
import { RegistrationsService } from './registrations.service';

/** Per-team tournament favourites shortlist (Captain + Vice-Captain). */
@Controller('tournaments/:tournamentId/favourite-players')
@UseGuards(JwtAuthGuard)
export class FavouritePlayersController {
  constructor(private readonly registrations: RegistrationsService) {}

  @Get()
  @RequirePermission(Permission.FAVOURITE_PLAYERS)
  @UseGuards(PermissionGuard)
  list(
    @CurrentUser() user: AuthUser,
    @Param('tournamentId') tournamentId: string,
  ): Promise<TournamentFavouritePlayersView> {
    return this.registrations.listFavouritePlayers(user, tournamentId);
  }

  @Put(':userId')
  @RequirePermission(Permission.FAVOURITE_PLAYERS)
  @UseGuards(PermissionGuard)
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
