import {
  type AuthUser,
  type SetTournamentScorersResponse,
  type TournamentScorersSelectionView,
} from '@acc/types';
import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SetTournamentScorersDto } from './dto/set-tournament-scorers.dto';
import { TournamentScorersService } from './tournament-scorers.service';

@Controller('tournaments/:tournamentId/scorers')
@UseGuards(JwtAuthGuard)
export class TournamentScorersController {
  constructor(private readonly scorers: TournamentScorersService) {}

  @Get()
  getSelectionView(
    @CurrentUser() user: AuthUser,
    @Param('tournamentId') tournamentId: string,
  ): Promise<TournamentScorersSelectionView> {
    return this.scorers.getSelectionView(user, tournamentId);
  }

  @Put()
  setScorers(
    @CurrentUser() user: AuthUser,
    @Param('tournamentId') tournamentId: string,
    @Body() dto: SetTournamentScorersDto,
  ): Promise<SetTournamentScorersResponse> {
    return this.scorers.setScorers(user, tournamentId, dto);
  }
}
