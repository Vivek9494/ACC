import {
  type AuthUser,
  type CenterSevakDashboard,
  type ManagerPlayerStats,
  MatchState,
} from '@acc/types';
import { ForbiddenException, Injectable } from '@nestjs/common';

import { DashboardFeaturedMatchesService } from '../matches/dashboard-featured-matches.service';
import { ParticipationPollService } from '../participation-poll/participation-poll.service';
import { TournamentsService } from '../tournaments/tournaments.service';
import { LeatherTournamentVisibilityService } from '../tournaments/leather-tournament-visibility.service';
import { activeTournamentWhere } from '../tournaments/tournament-query';
import { PrismaService } from '../prisma/prisma.service';
import { ScorecardReader } from '../scoring/scorecard-reader';

const PLAYED_STATES: MatchState[] = [
  MatchState.Live,
  MatchState.Completed,
  MatchState.ScorecardLocked,
  MatchState.NoResult,
];

@Injectable()
export class CenterSevakService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scorecardReader: ScorecardReader,
    private readonly tournaments: TournamentsService,
    private readonly leatherVisibility: LeatherTournamentVisibilityService,
    private readonly dashboardFeaturedMatches: DashboardFeaturedMatchesService,
    private readonly participationPolls: ParticipationPollService,
  ) {}

  async getDashboard(userId: string, actor: AuthUser): Promise<CenterSevakDashboard> {
    const centerIds = await this.resolveSevakCenterIds(userId);
    const centerTournamentIds = await this.listCenterTournamentIds(centerIds);
    const visibleLeatherIds = await this.leatherVisibility.getVisibleLeatherTournamentIds(userId);
    const tournamentIds = [...new Set([...centerTournamentIds, ...visibleLeatherIds])];

    const [featuredMatches, participationPoll, playerStats, tournaments] = await Promise.all([
      this.dashboardFeaturedMatches.loadTodayMatches(),
      this.participationPolls.loadDashboardPoll(userId),
      this.loadPlayerStats(userId, tournamentIds),
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

  private async listCenterTournamentIds(centerIds: string[]): Promise<string[]> {
    const links = await this.prisma.tournamentCenter.findMany({
      where: { centerId: { in: centerIds }, tournament: activeTournamentWhere },
      select: { tournamentId: true },
    });
    return [...new Set(links.map((row) => row.tournamentId))];
  }

  private async loadPlayerStats(
    userId: string,
    tournamentIds: string[],
  ): Promise<ManagerPlayerStats> {
    if (tournamentIds.length === 0) {
      return { matches: 0, runs: 0, wickets: 0 };
    }

    const squadRows = await this.prisma.matchSquadPlayer.findMany({
      where: {
        userId,
        squad: {
          match: {
            tournamentId: { in: tournamentIds },
            state: { in: PLAYED_STATES },
          },
        },
      },
      select: { squad: { select: { matchId: true } } },
    });

    const matchIds = [...new Set(squadRows.map((row) => row.squad.matchId))];
    if (matchIds.length === 0) {
      return { matches: 0, runs: 0, wickets: 0 };
    }

    let runs = 0;
    let wickets = 0;

    for (const matchId of matchIds) {
      const card = await this.scorecardReader.byMatchId(matchId);
      for (const inn of card.innings) {
        const batter = inn.batters.find((b) => b.playerId === userId);
        if (batter) {
          runs += batter.runs;
        }
        const bowler = inn.bowlers.find((b) => b.playerId === userId);
        if (bowler) {
          wickets += bowler.wickets;
        }
      }
    }

    return { matches: matchIds.length, runs, wickets };
  }
}
