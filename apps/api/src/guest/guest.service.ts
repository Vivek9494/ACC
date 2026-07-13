import {
  type GuestDashboard,
  deriveTournamentDisplayStatus,
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
    const liveMatch = await this.dashboardFeaturedMatches.loadGuestLiveMatch();
    if (liveMatch) {
      const featuredTournament = await this.loadTournamentById(liveMatch.tournamentId);
      return {
        liveMatch,
        upcomingMatch: null,
        recentMatch: null,
        featuredTournament,
      };
    }

    const [upcomingMatch, recentMatch] = await Promise.all([
      this.dashboardFeaturedMatches.loadGuestNextUpcomingMatch(),
      this.dashboardFeaturedMatches.loadGuestMostRecentCompletedMatch(),
    ]);
    const featuredTournamentId =
      upcomingMatch?.tournamentId ?? recentMatch?.tournamentId ?? null;
    const featuredTournament = featuredTournamentId
      ? await this.loadTournamentById(featuredTournamentId)
      : null;

    return {
      liveMatch: null,
      upcomingMatch,
      recentMatch,
      featuredTournament,
    };
  }

  private async loadTournamentById(tournamentId: string): Promise<TournamentSummary | null> {
    const row = await this.prisma.tournament.findFirst({
      where: {
        id: tournamentId,
        ...activeTournamentWhere,
      },
      include: { _count: { select: activeTeamCountSelect } },
    });
    return row ? this.toTournamentSummary(row) : null;
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
