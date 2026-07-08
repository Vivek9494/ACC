import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { SuspensionController } from './suspension.controller';
import { SuspensionService } from './suspension.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [SuspensionController],
  providers: [SuspensionService],
  exports: [SuspensionService],
})
export class SuspensionModule {}
