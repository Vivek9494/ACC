import { Module } from '@nestjs/common';

import { LiveGateway } from './live.gateway';
import { LiveService } from './live.service';

/**
 * Real-time live-score push (spec §29). Exposes {@link LiveService} so the
 * scoring slice can publish recomputed state after each mutation. Relies on the
 * global RedisModule for the live cache.
 */
@Module({
  providers: [LiveGateway, LiveService],
  exports: [LiveService],
})
export class LiveModule {}
