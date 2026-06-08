import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { RegistrationsController } from './registrations.controller';
import { RegistrationsService } from './registrations.service';

/**
 * Player registration flow (§7). Relies on the global AuthzModule (permission
 * engine), NotificationsModule and AuditModule; imports AuthModule for the
 * JwtAuthGuard's dependencies.
 */
@Module({
  imports: [AuthModule],
  controllers: [RegistrationsController],
  providers: [RegistrationsService],
})
export class RegistrationsModule {}
