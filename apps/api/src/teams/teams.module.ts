import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';
import { PlayerStatsModule } from '../player-stats/player-stats.module';
import { TournamentsModule } from '../tournaments/tournaments.module';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';

@Module({
  imports: [AuthModule, MediaModule, PlayerStatsModule, TournamentsModule],
  controllers: [TeamsController],
  providers: [TeamsService],
})
export class TeamsModule {}
