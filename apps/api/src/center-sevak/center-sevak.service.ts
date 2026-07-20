import { type AuthUser, type CenterSevakDashboard } from '@acc/types';
import { ForbiddenException, Injectable } from '@nestjs/common';

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
    await this.resolveSevakCenterIds(userId);

    const [featuredMatches, participationPoll, playerStats, tournaments] = await Promise.all([
      this.dashboardFeaturedMatches.loadTodayMatches(actor),
      this.participationPolls.loadDashboardPoll(userId),
      this.playerStatsService.buildDashboardHighLevelStats(userId),
      this.tournaments.listDashboardEntries(actor),
    ]);

    return { featuredMatches, participationPoll, playerStats, tournaments };
  }

  private async resolveSevakCenterIds(userId: string): Promise<string[]> {
    const centerIds = await this.tournaments.resolveCenterSevakCenterIds(userId);
    if (centerIds.length === 0) {
      throw new ForbiddenException({
        message: 'Center Sevak access required',
        error: 'FORBIDDEN',
      });
    }
    return centerIds;
  }
}
