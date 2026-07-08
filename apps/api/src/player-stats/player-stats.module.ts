import { Module } from '@nestjs/common';

import { ScoringModule } from '../scoring/scoring.module';
import { PlayerMomStatsService } from './player-mom-stats.service';
import { PlayerStatsService } from './player-stats.service';

@Module({
  imports: [ScoringModule],
  providers: [PlayerStatsService, PlayerMomStatsService],
  exports: [PlayerStatsService, PlayerMomStatsService],
})
export class PlayerStatsModule {}
