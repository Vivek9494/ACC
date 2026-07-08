import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { MatchesModule } from '../matches/matches.module';
import { ScoringModule } from '../scoring/scoring.module';
import { GuestController } from './guest.controller';
import { GuestService } from './guest.service';

@Module({
  imports: [AuthModule, ScoringModule, MatchesModule],
  controllers: [GuestController],
  providers: [GuestService],
})
export class GuestModule {}
