import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { KnockoutQualificationModule } from '../knockout-qualification/knockout-qualification.module';
import { KnockoutSeedingController } from './knockout-seeding.controller';
import { KnockoutSeedingService } from './knockout-seeding.service';

@Module({
  imports: [AuthModule, KnockoutQualificationModule],
  controllers: [KnockoutSeedingController],
  providers: [KnockoutSeedingService],
  exports: [KnockoutSeedingService],
})
export class KnockoutSeedingModule {}
