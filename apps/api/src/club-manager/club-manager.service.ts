import {
  type AuthUser,
  type ClubManagerDashboard,
  type DashboardPlayerPerformance,
} from '@acc/types';
import { Injectable } from '@nestjs/common';

import { CaptainService } from '../captain/captain.service';
import { DashboardFeaturedMatchesService } from '../matches/dashboard-featured-matches.service';
import { PrismaService } from '../prisma/prisma.service';
import { PlayerStatsService } from '../player-stats/player-stats.service';
import { TournamentsService } from '../tournaments/tournaments.service';

@Injectable()
export class ClubManagerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly playerStatsService: PlayerStatsService,
    private readonly tournaments: TournamentsService,
    private readonly dashboardFeaturedMatches: DashboardFeaturedMatchesService,
    private readonly captain: CaptainService,
  ) {}

  async getDashboard(actor: AuthUser): Promise<ClubManagerDashboard> {
    const [tournaments, featuredMatches, playerStats, teamLeadMatchCards, squadParticipationPoll] =
      await Promise.all([
        this.tournaments.listDashboardEntries(actor),
        this.dashboardFeaturedMatches.loadTodayMatches(),
        this.loadPlayerStats(actor.id),
        this.captain.loadTeamLeadMatchCards(actor),
        this.captain.loadSquadParticipationPoll(actor.id),
      ]);

    return {
      featuredMatches,
      upcomingMatchCard: teamLeadMatchCards.upcomingMatchCard,
      participationPoll: teamLeadMatchCards.upcomingMatchCard ? null : squadParticipationPoll,
      playerStats,
      tournaments,
    };
  }

  private async loadPlayerStats(managerId: string): Promise<DashboardPlayerPerformance | null> {
    const registration = await this.prisma.registration.findFirst({
      where: { userId: managerId },
      select: { id: true },
    });
    if (!registration) {
      return null;
    }

    return this.playerStatsService.buildDashboardHighLevelStats(managerId);
  }
}
