import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';
import { PlayerSkillVideosModule } from '../player-videos/player-skill-videos.module';
import { TournamentsController } from './tournaments.controller';
import { TournamentsService } from './tournaments.service';

/**
 * Tournament creation & management (§6, §24). Relies on the global AuthzModule
 * (permission engine, type resolver) and NotificationsModule.
 */
@Module({
  imports: [AuthModule, MediaModule, PlayerSkillVideosModule],
  controllers: [TournamentsController],
  providers: [TournamentsService],
  exports: [TournamentsService],
})
export class TournamentsModule {}
