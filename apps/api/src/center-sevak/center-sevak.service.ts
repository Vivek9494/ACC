import {
  type AuthUser,
  type CenterSevakDashboard,
  type FeaturedMatchSummary,
  type ManagerPlayerStats,
  MatchState,
  type MatchSummaryTeamView,
  type TournamentDashboardEntry,
  type TournamentSummary,
} from '@acc/types';
import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Match, Tournament } from '@prisma/client';

import { TournamentsService } from '../tournaments/tournaments.service';
import { PrismaService } from '../prisma/prisma.service';
import { ScorecardReader } from '../scoring/scorecard-reader';

type TournamentWithCounts = Tournament & { _count: { teams: number } };

type MatchWithTeams = Match & {
  homeTeam: { id: string; name: string } | null;
  awayTeam: { id: string; name: string } | null;
  tournament: { name: string };
  resultNote: string | null;
};

const UPCOMING_STATES: MatchState[] = [
  MatchState.Scheduled,
  MatchState.PlayingXiLocked,
  MatchState.TossCompleted,
  MatchState.Delayed,
];

const LIVE_STATES: MatchState[] = [MatchState.Live, MatchState.RainInterrupted];

const COMPLETED_STATES: MatchState[] = [
  MatchState.Completed,
  MatchState.ScorecardLocked,
  MatchState.NoResult,
];

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
  ) {}

  async getDashboard(userId: string, actor: AuthUser): Promise<CenterSevakDashboard> {
    const centerIds = await this.resolveSevakCenterIds(userId);
    const tournamentIds = await this.listCenterTournamentIds(centerIds);

    const [featuredMatch, playerStats, tournaments] = await Promise.all([
      this.loadFeaturedMatch(tournamentIds),
      this.loadPlayerStats(userId, tournamentIds),
      this.listTournamentsWithPermissions(actor, centerIds, tournamentIds),
    ]);

    return { featuredMatch, playerStats, tournaments };
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
      where: { centerId: { in: centerIds } },
      select: { tournamentId: true },
    });
    return [...new Set(links.map((row) => row.tournamentId))];
  }

  private async loadFeaturedMatch(tournamentIds: string[]): Promise<FeaturedMatchSummary | null> {
    if (tournamentIds.length === 0) {
      return null;
    }

    const match = await this.prisma.match.findFirst({
      where: {
        tournamentId: { in: tournamentIds },
        state: { in: COMPLETED_STATES },
      },
      orderBy: [{ matchDate: 'desc' }, { createdAt: 'desc' }],
      include: {
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
        tournament: { select: { name: true } },
      },
    });

    if (!match) {
      return null;
    }

    return this.buildFeaturedMatch(match);
  }

  private async buildFeaturedMatch(match: MatchWithTeams): Promise<FeaturedMatchSummary> {
    const state = match.state as MatchState;
    const isUpcoming = UPCOMING_STATES.includes(state);
    const isLive = LIVE_STATES.includes(state);

    const homeName = match.homeTeam?.name ?? 'TBD';
    const awayName = match.awayTeam?.name ?? match.externalOpponentName ?? 'TBD';

    let teamA: MatchSummaryTeamView = {
      name: homeName,
      logoUrl: null,
      score: null,
      overs: null,
      isWinner: false,
    };
    let teamB: MatchSummaryTeamView = {
      name: awayName,
      logoUrl: null,
      score: null,
      overs: null,
      isWinner: false,
    };
    let resultNote: string | null = match.resultNote;

    if (!isUpcoming) {
      try {
        const card = await this.scorecardReader.build(match);
        const homeId = match.homeTeamId;
        const awayId = match.awayTeamId;

        const homeInnings = card.innings.filter((inn) => inn.battingTeamId === homeId);
        const awayInnings = card.innings.filter((inn) => inn.battingTeamId === awayId);

        const homeAgg = this.aggregateInnings(homeInnings);
        const awayAgg = this.aggregateInnings(awayInnings);

        const winnerId = card.result.winningTeamId ?? match.winningTeamId;
        const homeWinner = winnerId !== null && winnerId === homeId;
        const awayWinner = winnerId !== null && winnerId === awayId;

        teamA = {
          name: homeName,
          logoUrl: null,
          score: homeAgg.score,
          overs: homeAgg.overs,
          isWinner: homeWinner,
        };
        teamB = {
          name: awayName,
          logoUrl: null,
          score: awayAgg.score,
          overs: awayAgg.overs,
          isWinner: awayWinner,
        };

        if (!isLive) {
          resultNote = card.result.note ?? match.resultNote;
        }
      } catch {
        // Scorecard not yet available — keep rows without scores.
      }
    }

    return {
      matchId: match.id,
      tournamentName: match.tournament.name,
      state,
      teamA,
      teamB,
      resultNote,
      isLive,
      isUpcoming,
    };
  }

  private aggregateInnings(
    innings: { runs: number; wickets: number; oversText: string; closed: boolean }[],
  ): { score: string | null; overs: string | null } {
    if (innings.length === 0) {
      return { score: null, overs: null };
    }

    const primary = innings[0]!;
    const runs = innings.reduce((sum, inn) => sum + inn.runs, 0);
    const wickets = innings.reduce((sum, inn) => sum + inn.wickets, 0);
    const score =
      primary.closed && wickets >= 10 ? `${runs}` : `${runs}/${wickets}`;
    const overs = `${primary.oversText} OVERS`;

    return { score, overs };
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

  private async listTournamentsWithPermissions(
    actor: AuthUser,
    centerIds: string[],
    tournamentIds: string[],
  ): Promise<TournamentDashboardEntry[]> {
    if (tournamentIds.length === 0) {
      return [];
    }

    const rows = await this.prisma.tournament.findMany({
      where: { id: { in: tournamentIds } },
      orderBy: [{ startAt: 'desc' }, { createdAt: 'desc' }],
      include: { _count: { select: { teams: true } } },
    });

    const entries: TournamentDashboardEntry[] = [];
    for (const row of rows) {
      const actionCenterId = await this.resolveActionCenterId(row.id, centerIds);
      const permissions = await this.tournaments.resolveDashboardPermissions(
        actor,
        { id: row.id, createdByUserId: row.createdByUserId },
        actionCenterId,
      );
      entries.push({
        tournament: this.toTournamentSummary(row),
        permissions,
      });
    }
    return entries;
  }

  private async resolveActionCenterId(
    tournamentId: string,
    sevakCenterIds: string[],
  ): Promise<string> {
    const link = await this.prisma.tournamentCenter.findFirst({
      where: { tournamentId, centerId: { in: sevakCenterIds } },
      select: { centerId: true },
    });
    return link?.centerId ?? sevakCenterIds[0]!;
  }

  private toTournamentSummary(row: TournamentWithCounts): TournamentSummary {
    return {
      id: row.id,
      name: row.name,
      year: row.year,
      type: row.type,
      state: row.state,
      ballType: row.ballType,
      posterUrl: row.posterUrl,
      startAt: row.startAt.toISOString(),
      endAt: row.endAt.toISOString(),
      location: row.location,
      teamCount: row._count.teams,
    };
  }
}
