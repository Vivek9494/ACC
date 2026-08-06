import { Module } from '@nestjs/common';

import { ScoringModule } from '../scoring/scoring.module';
import { StorageModule } from '../storage/storage.module';
import { BroadcastPlayerStatsController } from './broadcast-player-stats.controller';
import { PlayerMomStatsService } from './player-mom-stats.service';
import { PlayerStatsService } from './player-stats.service';

@Module({
  imports: [ScoringModule, StorageModule],
  controllers: [BroadcastPlayerStatsController],
  providers: [PlayerStatsService, PlayerMomStatsService],
  exports: [PlayerStatsService, PlayerMomStatsService],
})
export class PlayerStatsModule {}
