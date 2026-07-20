import { Module, forwardRef } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ScoringModule } from '../scoring/scoring.module';
import { TournamentsModule } from '../tournaments/tournaments.module';
import { StandingsController } from './standings.controller';
import { StandingsService } from './standings.service';

@Module({
  imports: [AuthModule, TournamentsModule, forwardRef(() => ScoringModule)],
  controllers: [StandingsController],
  providers: [StandingsService],
  exports: [StandingsService],
})
export class StandingsModule {}
