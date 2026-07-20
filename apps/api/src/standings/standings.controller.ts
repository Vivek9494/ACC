import { type TournamentStandings } from '@acc/types';
import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { AuthService } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';
import { StandingsService } from './standings.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class StandingsController {
  constructor(
    private readonly standings: StandingsService,
    private readonly auth: AuthService,
  ) {}

  @Get('tournaments/:tournamentId/standings')
  @Public()
  async getStandings(
    @Param('tournamentId') tournamentId: string,
    @Req() req: Request,
  ): Promise<TournamentStandings> {
    const viewer = await this.auth.resolveOptionalUser(req);
    return this.standings.getStandings(tournamentId, viewer);
  }
}
