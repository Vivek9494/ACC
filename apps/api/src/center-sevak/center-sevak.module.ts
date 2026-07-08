import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { AuthzModule } from '../authz/authz.module';
import { MatchesModule } from '../matches/matches.module';
import { ParticipationPollModule } from '../participation-poll/participation-poll.module';
import { ScoringModule } from '../scoring/scoring.module';
import { TournamentsModule } from '../tournaments/tournaments.module';
import { CenterSevakController } from './center-sevak.controller';
import { CenterSevakService } from './center-sevak.service';

@Module({
  imports: [AuthModule, AuthzModule, ScoringModule, TournamentsModule, MatchesModule, ParticipationPollModule],
  controllers: [CenterSevakController],
  providers: [CenterSevakService],
})
export class CenterSevakModule {}
