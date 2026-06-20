import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ParticipationPollModule } from '../participation-poll/participation-poll.module';
import { ScoringModule } from '../scoring/scoring.module';
import { CaptainController } from './captain.controller';
import { CaptainRoleGuard } from './captain-role.guard';
import { CaptainService } from './captain.service';

@Module({
  imports: [AuthModule, ScoringModule, ParticipationPollModule],
  controllers: [CaptainController],
  providers: [CaptainService, CaptainRoleGuard],
})
export class CaptainModule {}
