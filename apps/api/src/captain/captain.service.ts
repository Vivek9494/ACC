import {
  type CaptainDashboard,
  type CaptainFeaturedMatchStatus,
  type CaptainFeaturedMatchSummary,
  type ManagerPlayerStats,
  MatchState,
  type MatchSummaryTeamView,
  type TournamentSummary,
  TossDecision,
  UserRole,
} from '@acc/types';
import { Injectable } from '@nestjs/common';
import type { Match, Tournament } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { ScorecardReader } from '../scoring/scorecard-reader';

type TournamentWithCounts = Tournament & { _count: { teams: number } };

type MatchWithTeams = Match & {
  homeTeam: { id: string; name: string } | null;
  awayTeam: { id: string; name: string } | null;
  tournament: { name: string };
};

const UPCOMING_STATES: MatchState[] = [
  MatchState.Scheduled,
  MatchState.PlayingXiLocked,
  MatchState.TossCompleted,
  MatchState.Delayed,
];

const LIVE_STATES: MatchState[] = [MatchState.Live, MatchState.RainInterrupted];

const PLAYED_STATES: MatchState[] = [
  MatchState.Live,
  MatchState.Completed,
  MatchState.ScorecardLocked,
  MatchState.NoResult,
];

@Injectable()
export class CaptainService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scorecardReader: ScorecardReader,
  ) {}

  async getDashboard(userId: string): Promise<CaptainDashboard> {
    const leadership = await this.prisma.roleAssignment.findMany({
      where: {
        userId,
        role: { in: [UserRole.Captain, UserRole.ViceCaptain] },
      },
      select: { teamId: true, tournamentId: true },
    });

    const teamIds = [
      ...new Set(leadership.map((row) => row.teamId).filter((id): id is string => Boolean(id))),
    ];
    const tournamentIds = [
      ...new Set(
        leadership.map((row) => row.tournamentId).filter((id): id is string => Boolean(id)),
      ),
    ];

    const [featuredMatch, playerStats, tournaments] = await Promise.all([
      this.loadFeaturedMatch(teamIds),
      this.loadPlayerStats(userId, tournamentIds),
      this.listTeamTournaments(tournamentIds),
    ]);

    return { featuredMatch, playerStats, tournaments };
  }

  private async loadFeaturedMatch(teamIds: string[]): Promise<CaptainFeaturedMatchSummary | null> {
    if (teamIds.length === 0) {
      return null;
    }

    const teamFilter = {
      OR: [{ homeTeamId: { in: teamIds } }, { awayTeamId: { in: teamIds } }],
    };

    const liveMatch = await this.prisma.match.findFirst({
      where: { ...teamFilter, state: { in: LIVE_STATES } },
      orderBy: [{ matchDate: 'desc' }, { createdAt: 'desc' }],
      include: {
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
        tournament: { select: { name: true } },
      },
    });

    const match =
      liveMatch ??
      (await this.prisma.match.findFirst({
        where: { ...teamFilter, state: { in: UPCOMING_STATES } },
        orderBy: [{ matchDate: 'asc' }, { createdAt: 'asc' }],
        include: {
          homeTeam: { select: { id: true, name: true } },
          awayTeam: { select: { id: true, name: true } },
          tournament: { select: { name: true } },
        },
      }));

    if (!match) {
      return null;
    }

    return this.buildFeaturedMatch(match);
  }

  private async buildFeaturedMatch(
    match: MatchWithTeams,
  ): Promise<CaptainFeaturedMatchSummary> {
    const state = match.state as MatchState;
    const status = this.resolveStatus(state);
    const isUpcoming = status === 'UPCOMING';

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
    let resultLine: string | null = null;

    if (!isUpcoming) {
      try {
        const card = await this.scorecardReader.build(match);
        const homeId = match.homeTeamId;
        const awayId = match.awayTeamId;

        const homeInnings = card.innings.filter((inn) => inn.battingTeamId === homeId);
        const awayInnings = card.innings.filter((inn) => inn.battingTeamId === awayId);

        const homeAgg = this.aggregateInnings(homeInnings);
        const awayAgg = this.aggregateInnings(awayInnings);

        const winnerId = card.result.winningTeamId;
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

        if (status === 'COMPLETED' && card.result.note) {
          resultLine = card.result.note;
        }
      } catch {
        // Scorecard not yet available — keep rows without scores.
      }
    }

    const infoLine = status === 'LIVE' || status === 'UPCOMING' ? this.tossLine(match) : null;

    return {
      matchId: match.id,
      tournamentName: match.tournament.name,
      state,
      status,
      teamA,
      teamB,
      infoLine,
      resultLine,
    };
  }

  private resolveStatus(state: MatchState): CaptainFeaturedMatchStatus {
    if (LIVE_STATES.includes(state)) {
      return 'LIVE';
    }
    if (UPCOMING_STATES.includes(state)) {
      return 'UPCOMING';
    }
    return 'COMPLETED';
  }

  private tossLine(match: MatchWithTeams): string | null {
    if (!match.tossWinner || !match.tossDecision) {
      return null;
    }
    const homeName = match.homeTeam?.name ?? 'TBD';
    const awayName = match.awayTeam?.name ?? match.externalOpponentName ?? 'TBD';
    const winnerName = match.tossWinner === 'TEAM_A' ? homeName : awayName;
    const decision = match.tossDecision === TossDecision.Bat ? 'bat' : 'bowl';
    return `${winnerName} won the toss and chose to ${decision}`;
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

  private async listTeamTournaments(tournamentIds: string[]): Promise<TournamentSummary[]> {
    if (tournamentIds.length === 0) {
      return [];
    }

    const rows = await this.prisma.tournament.findMany({
      where: { id: { in: tournamentIds } },
      orderBy: [{ startAt: 'desc' }, { createdAt: 'desc' }],
      include: { _count: { select: { teams: true } } },
    });

    return rows.map((row) => this.toTournamentSummary(row));
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
