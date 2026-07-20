import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { LiveModule } from '../live/live.module';
import { ScoringModule } from '../scoring/scoring.module';
import { TournamentsModule } from '../tournaments/tournaments.module';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardService } from './leaderboard.service';

@Module({
  imports: [AuthModule, LiveModule, ScoringModule, TournamentsModule],
  controllers: [LeaderboardController],
  providers: [LeaderboardService],
  exports: [LeaderboardService],
})
export class LeaderboardModule {}
