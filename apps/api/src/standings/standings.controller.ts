import { type TournamentStandings } from '@acc/types';
import { Controller, Get, Param, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';
import { StandingsService } from './standings.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class StandingsController {
  constructor(private readonly standings: StandingsService) {}

  @Get('tournaments/:tournamentId/standings')
  @Public()
  getStandings(@Param('tournamentId') tournamentId: string): Promise<TournamentStandings> {
    return this.standings.getStandings(tournamentId);
  }
}
