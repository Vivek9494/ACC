import { Module } from '@nestjs/common';

import { ScoringModule } from '../scoring/scoring.module';
import { PlayerStatsService } from './player-stats.service';

@Module({
  imports: [ScoringModule],
  providers: [PlayerStatsService],
  exports: [PlayerStatsService],
})
export class PlayerStatsModule {}
