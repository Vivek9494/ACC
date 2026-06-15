import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';
import { TournamentsModule } from '../tournaments/tournaments.module';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';

@Module({
  imports: [AuthModule, MediaModule, TournamentsModule],
  controllers: [TeamsController],
  providers: [TeamsService],
})
export class TeamsModule {}
