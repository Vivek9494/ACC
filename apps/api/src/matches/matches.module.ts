import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { LiveModule } from '../live/live.module';
import { ScoringModule } from '../scoring/scoring.module';
import { StandingsModule } from '../standings/standings.module';
import { StorageModule } from '../storage/storage.module';
import { SuspensionModule } from '../suspension/suspension.module';
import { TournamentsModule } from '../tournaments/tournaments.module';
import { MatchesController } from './matches.controller';
import { DashboardFeaturedMatchesService } from './dashboard-featured-matches.service';
import { MatchesService } from './matches.service';
import { ScorerDashboardMatchService } from './scorer-dashboard-match.service';

/**
 * Match setup (spec §5.2, §11). Relies on the global AuthzModule
 * (PermissionService / PermissionGuard / MatchScorerGrantService),
 * NotificationsModule and AuditModule; imports AuthModule for JwtAuthGuard.
 */
@Module({
  imports: [AuthModule, LiveModule, StandingsModule, ScoringModule, SuspensionModule, TournamentsModule, StorageModule],
  controllers: [MatchesController],
  providers: [MatchesService, ScorerDashboardMatchService, DashboardFeaturedMatchesService],
  exports: [MatchesService, ScorerDashboardMatchService, DashboardFeaturedMatchesService],
})
export class MatchesModule {}
