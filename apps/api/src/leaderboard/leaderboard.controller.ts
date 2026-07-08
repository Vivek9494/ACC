import { type TournamentLeaderboard, type TournamentStatsView } from '@acc/types';
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';
import { LeaderboardService } from './leaderboard.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class LeaderboardController {
  constructor(private readonly leaderboard: LeaderboardService) {}

  @Get('tournaments/:tournamentId/leaderboard')
  @Public()
  getLeaderboard(
    @Param('tournamentId') tournamentId: string,
    @Query('teamId') teamId?: string,
  ): Promise<TournamentLeaderboard> {
    return this.leaderboard.getLeaderboard(tournamentId, teamId?.trim() || null);
  }

  @Get('tournaments/:tournamentId/stats')
  @Public()
  getTournamentStats(@Param('tournamentId') tournamentId: string): Promise<TournamentStatsView> {
    return this.leaderboard.getTournamentStats(tournamentId);
  }
}
