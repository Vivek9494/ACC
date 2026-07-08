import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { LiveModule } from '../live/live.module';
import { ScoringModule } from '../scoring/scoring.module';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardService } from './leaderboard.service';

@Module({
  imports: [AuthModule, LiveModule, ScoringModule],
  controllers: [LeaderboardController],
  providers: [LeaderboardService],
  exports: [LeaderboardService],
})
export class LeaderboardModule {}
