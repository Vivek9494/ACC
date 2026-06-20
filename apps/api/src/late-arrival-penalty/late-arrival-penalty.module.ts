import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AuthzModule } from '../authz/authz.module';
import { LateArrivalPenaltyController } from './late-arrival-penalty.controller';
import { LateArrivalPenaltyService } from './late-arrival-penalty.service';

@Module({
  imports: [AuthModule, AuthzModule, AuditModule],
  controllers: [LateArrivalPenaltyController],
  providers: [LateArrivalPenaltyService],
  exports: [LateArrivalPenaltyService],
})
export class LateArrivalPenaltyModule {}
