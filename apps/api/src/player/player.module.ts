import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { MatchesModule } from '../matches/matches.module';
import { ParticipationPollModule } from '../participation-poll/participation-poll.module';
import { PlayerStatsModule } from '../player-stats/player-stats.module';
import { ScoringModule } from '../scoring/scoring.module';
import { TournamentsModule } from '../tournaments/tournaments.module';
import { PlayerController } from './player.controller';
import { PlayerRoleGuard } from './player-role.guard';
import { PlayerService } from './player.service';

@Module({
  imports: [
    AuthModule,
    MatchesModule,
    ScoringModule,
    ParticipationPollModule,
    PlayerStatsModule,
    TournamentsModule,
  ],
  controllers: [PlayerController],
  providers: [PlayerService, PlayerRoleGuard],
})
export class PlayerModule {}
