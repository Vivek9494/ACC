import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AuthzModule } from '../authz/authz.module';
import { LateArrivalPenaltyModule } from '../late-arrival-penalty/late-arrival-penalty.module';
import { SuspensionModule } from '../suspension/suspension.module';
import { MatchesModule } from '../matches/matches.module';
import { ParticipationPollController } from './participation-poll.controller';
import { ParticipationPollService } from './participation-poll.service';

@Module({
  imports: [AuthModule, AuthzModule, AuditModule, MatchesModule, LateArrivalPenaltyModule, SuspensionModule],
  controllers: [ParticipationPollController],
  providers: [ParticipationPollService],
  exports: [ParticipationPollService],
})
export class ParticipationPollModule {}
