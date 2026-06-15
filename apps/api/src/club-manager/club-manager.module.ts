import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { AuthzModule } from '../authz/authz.module';
import { ScoringModule } from '../scoring/scoring.module';
import { TournamentsModule } from '../tournaments/tournaments.module';
import { ClubManagerController } from './club-manager.controller';
import { ClubManagerService } from './club-manager.service';

@Module({
  imports: [AuthModule, AuthzModule, ScoringModule, TournamentsModule],
  controllers: [ClubManagerController],
  providers: [ClubManagerService],
})
export class ClubManagerModule {}
