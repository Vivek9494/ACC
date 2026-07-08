import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { LiveGateway } from './live.gateway';
import { LiveService } from './live.service';
import { UserGateway } from './user.gateway';

/**
 * Real-time live-score push (spec §29). Exposes {@link LiveService} so the
 * scoring slice can publish recomputed state after each mutation. Relies on the
 * global RedisModule for the live cache.
 */
@Module({
  imports: [AuthModule],
  providers: [LiveGateway, LiveService, UserGateway],
  exports: [LiveService],
})
export class LiveModule {}
