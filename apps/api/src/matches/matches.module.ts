import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';

/**
 * Match setup (spec §5.2, §11). Relies on the global AuthzModule
 * (PermissionService / PermissionGuard / MatchScorerGrantService),
 * NotificationsModule and AuditModule; imports AuthModule for JwtAuthGuard.
 */
@Module({
  imports: [AuthModule],
  controllers: [MatchesController],
  providers: [MatchesService],
})
export class MatchesModule {}
