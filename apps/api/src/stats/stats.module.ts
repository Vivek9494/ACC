import { Global, Module } from '@nestjs/common';

import { PlayerCareerCacheService } from './player-career-cache.service';
import { StatsInvalidationService } from './stats-invalidation.service';
import { TournamentAggregatesCacheService } from './tournament-aggregates-cache.service';

/** Global: stats caches are invalidated from many feature modules. */
@Global()
@Module({
  providers: [TournamentAggregatesCacheService, PlayerCareerCacheService, StatsInvalidationService],
  exports: [TournamentAggregatesCacheService, PlayerCareerCacheService, StatsInvalidationService],
})
export class StatsModule {}
