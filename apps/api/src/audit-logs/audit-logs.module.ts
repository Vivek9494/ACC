import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { AuditLogRetentionService } from './audit-log-retention.service';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogsService } from './audit-logs.service';

@Module({
  imports: [AuthModule],
  controllers: [AuditLogsController],
  providers: [AuditLogsService, AuditLogRetentionService],
})
export class AuditLogsModule {}
