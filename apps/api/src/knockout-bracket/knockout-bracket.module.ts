import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { KnockoutSeedingModule } from '../knockout-seeding/knockout-seeding.module';
import { KnockoutBracketController } from './knockout-bracket.controller';
import { KnockoutBracketService } from './knockout-bracket.service';
import { KnockoutProgressionService } from './knockout-progression.service';

@Module({
  imports: [AuthModule, AuditModule, KnockoutSeedingModule],
  controllers: [KnockoutBracketController],
  providers: [KnockoutBracketService, KnockoutProgressionService],
  exports: [KnockoutBracketService, KnockoutProgressionService],
})
export class KnockoutBracketModule {}
