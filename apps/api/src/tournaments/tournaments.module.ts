import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { TournamentsController } from './tournaments.controller';
import { TournamentsService } from './tournaments.service';

/**
 * Tournament creation & management (§6, §24). Relies on the global AuthzModule
 * (permission engine, type resolver) and NotificationsModule.
 */
@Module({
  imports: [AuthModule],
  controllers: [TournamentsController],
  providers: [TournamentsService],
})
export class TournamentsModule {}
