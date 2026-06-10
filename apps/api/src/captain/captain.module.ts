import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ScoringModule } from '../scoring/scoring.module';
import { CaptainController } from './captain.controller';
import { CaptainRoleGuard } from './captain-role.guard';
import { CaptainService } from './captain.service';

@Module({
  imports: [AuthModule, ScoringModule],
  controllers: [CaptainController],
  providers: [CaptainService, CaptainRoleGuard],
})
export class CaptainModule {}
