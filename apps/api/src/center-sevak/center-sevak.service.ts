import { type AuthUser, type CenterSevakDashboard } from '@acc/types';
import { Injectable } from '@nestjs/common';

import { DashboardFeaturedMatchesService } from '../matches/dashboard-featured-matches.service';
import { ParticipationPollService } from '../participation-poll/participation-poll.service';
import { PlayerStatsService } from '../player-stats/player-stats.service';
import { TournamentsService } from '../tournaments/tournaments.service';

@Injectable()
export class CenterSevakService {
  constructor(
    private readonly tournaments: TournamentsService,
    private readonly playerStatsService: PlayerStatsService,
    private readonly dashboardFeaturedMatches: DashboardFeaturedMatchesService,
    private readonly participationPolls: ParticipationPollService,
  ) {}

  async getDashboard(userId: string, actor: AuthUser): Promise<CenterSevakDashboard> {
    // Heal missing Sevak RoleAssignment when possible; never block Home.
    await this.tournaments.resolveCenterSevakCenterIds(userId);

    const [featuredMatches, participationPoll, playerStats, tournaments] = await Promise.all([
      this.dashboardFeaturedMatches.loadTodayMatches(actor),
      this.participationPolls.loadDashboardPoll(userId),
      this.playerStatsService.buildDashboardHighLevelStats(userId),
      this.tournaments.listDashboardEntries(actor),
    ]);

    return { featuredMatches, participationPoll, playerStats, tournaments };
  }
}
