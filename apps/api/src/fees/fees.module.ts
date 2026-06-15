import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { FeesController } from './fees.controller';
import { FeesService } from './fees.service';

/** Manual fee tracking (§20). */
@Module({
  imports: [AuthModule],
  controllers: [FeesController],
  providers: [FeesService],
})
export class FeesModule {}
