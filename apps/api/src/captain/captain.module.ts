import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { MatchesModule } from '../matches/matches.module';
import { ParticipationPollModule } from '../participation-poll/participation-poll.module';
import { PlayerStatsModule } from '../player-stats/player-stats.module';
import { ScoringModule } from '../scoring/scoring.module';
import { TournamentsModule } from '../tournaments/tournaments.module';
import { CaptainController } from './captain.controller';
import { CaptainRoleGuard } from './captain-role.guard';
import { CaptainService } from './captain.service';

@Module({
  imports: [
    AuthModule,
    MatchesModule,
    ScoringModule,
    ParticipationPollModule,
    PlayerStatsModule,
    TournamentsModule,
  ],
  controllers: [CaptainController],
  providers: [CaptainService, CaptainRoleGuard],
  exports: [CaptainService],
})
export class CaptainModule {}
