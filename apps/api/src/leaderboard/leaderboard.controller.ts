import { type TournamentLeaderboard, type TournamentStatsView } from '@acc/types';
import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { AuthService } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';
import { LeaderboardService } from './leaderboard.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class LeaderboardController {
  constructor(
    private readonly leaderboard: LeaderboardService,
    private readonly auth: AuthService,
  ) {}

  @Get('tournaments/:tournamentId/leaderboard')
  @Public()
  async getLeaderboard(
    @Param('tournamentId') tournamentId: string,
    @Req() req: Request,
    @Query('teamId') teamId?: string,
  ): Promise<TournamentLeaderboard> {
    const viewer = await this.auth.resolveOptionalUser(req);
    return this.leaderboard.getLeaderboard(tournamentId, teamId?.trim() || null, viewer);
  }

  @Get('tournaments/:tournamentId/stats')
  @Public()
  async getTournamentStats(
    @Param('tournamentId') tournamentId: string,
    @Req() req: Request,
    @Query('teamId') teamId?: string,
  ): Promise<TournamentStatsView> {
    const viewer = await this.auth.resolveOptionalUser(req);
    return this.leaderboard.getTournamentStats(tournamentId, teamId?.trim() || null, viewer);
  }
}
