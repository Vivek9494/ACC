import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { StandingsModule } from '../standings/standings.module';
import { KnockoutQualificationController } from './knockout-qualification.controller';
import { KnockoutQualificationService } from './knockout-qualification.service';

@Module({
  imports: [AuthModule, StandingsModule],
  controllers: [KnockoutQualificationController],
  providers: [KnockoutQualificationService],
  exports: [KnockoutQualificationService],
})
export class KnockoutQualificationModule {}
