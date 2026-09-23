import {
  BallType,
  type GuestDashboard,
  deriveTournamentDisplayStatus,
  selectDashboardTournaments,
  type TournamentSummary,
} from '@acc/types';
import { Injectable } from '@nestjs/common';
import type { Tournament } from '@prisma/client';

import { DashboardFeaturedMatchesService } from '../matches/dashboard-featured-matches.service';
import { PrismaService } from '../prisma/prisma.service';
import { MediaUrlResolver } from '../storage/media-url.resolver';
import { activeTeamCountSelect } from '../teams/team-query';
import { activeTournamentWhere } from '../tournaments/tournament-query';
import { buildTournamentScopeDisplay } from '../tournaments/tournament-scope-display';

type TournamentWithCounts = Tournament & { _count: { teams: number } };

@Injectable()
export class GuestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaUrls: MediaUrlResolver,
    private readonly dashboardFeaturedMatches: DashboardFeaturedMatchesService,
  ) {}

  async getDashboard(): Promise<GuestDashboard> {
    const [liveMatches, upcomingMatches, recentMatch, featuredTournament] =
      await Promise.all([
        this.dashboardFeaturedMatches.loadLiveMatches(null),
        this.dashboardFeaturedMatches.loadUpcomingMatches(null),
        this.dashboardFeaturedMatches.loadGuestMostRecentCompletedMatch(),
        this.loadFeaturedTournament(),
      ]);

    return {
      liveMatches,
      upcomingMatches,
      recentMatch: liveMatches.length > 0 ? null : recentMatch,
      featuredTournament,
    };
  }

  /**
   * Same priority as role homes ({@link selectDashboardTournaments}):
   * all Upcoming then Live, else single most-recent Completed.
   * Guest visibility: Tennis / public only — never Leather.
   */
  private async loadFeaturedTournament(): Promise<TournamentSummary | null> {
    const rows = await this.prisma.tournament.findMany({
      where: {
        ...activeTournamentWhere,
        ballType: BallType.Tennis,
      },
      include: { _count: { select: activeTeamCountSelect } },
    });

    const candidates = await Promise.all(
      rows.map(async (row) => {
        const tournament = await this.toTournamentSummary(row);
        return { tournament, cancelled: false as const };
      }),
    );

    const [featured] = selectDashboardTournaments(candidates);
    return featured?.tournament ?? null;
  }

  private async toTournamentSummary(row: TournamentWithCounts): Promise<TournamentSummary> {
    const scopeDisplay = await buildTournamentScopeDisplay(
      this.prisma,
      row.id,
      row.type as TournamentSummary['type'],
      row.ballType as TournamentSummary['ballType'],
      row.provinceId,
    );
    return {
      id: row.id,
      name: row.name,
      year: row.year,
      type: row.type,
      state: row.state,
      displayStatus: deriveTournamentDisplayStatus({
        startAt: row.startAt.toISOString(),
        endAt: row.endAt.toISOString(),
        timezone: row.timezone,
      }),
      ballType: row.ballType,
      posterUrl: await this.mediaUrls.resolveReadUrl(row.posterUrl),
      startAt: row.startAt.toISOString(),
      endAt: row.endAt.toISOString(),
      locationAddress: row.locationAddress,
      latitude: row.latitude,
      longitude: row.longitude,
      provinceId: row.provinceId,
      timezone: row.timezone,
      teamCount: row._count.teams,
      scopeDisplay,
    };
  }
}
