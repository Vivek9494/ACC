import {
  BALLS_PER_OVER,
  type CaptainFeaturedMatchStatus,
  InningsType,
  type ManagerPlayerStats,
  MatchState,
  type MatchSummaryTeamView,
  type PlayerDashboard,
  type PlayerFeaturedMatchSummary,
  type ScorecardResponse,
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
  tournament: { name: string; oversPerInnings: number };
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
export class PlayerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scorecardReader: ScorecardReader,
  ) {}

  async getDashboard(userId: string): Promise<PlayerDashboard> {
    const [memberships, registrations] = await Promise.all([
      this.prisma.teamMembership.findMany({
        where: { userId },
        select: { teamId: true, tournamentId: true },
      }),
      this.prisma.registration.findMany({
        where: { userId, status: 'CONFIRMED' },
        select: { tournamentId: true },
      }),
    ]);

    const teamIds = [
      ...new Set(memberships.map((row) => row.teamId).filter((id): id is string => Boolean(id))),
    ];
    const tournamentIds = [
      ...new Set([
        ...memberships.map((row) => row.tournamentId),
        ...registrations.map((row) => row.tournamentId),
      ]),
    ];

    const [featuredMatch, playerStats, tournaments] = await Promise.all([
      this.loadFeaturedMatch(teamIds),
      this.loadPlayerStats(userId, tournamentIds),
      this.listTournaments(tournamentIds),
    ]);

    return { featuredMatch, playerStats, tournaments };
  }

  private async loadFeaturedMatch(teamIds: string[]): Promise<PlayerFeaturedMatchSummary | null> {
    if (teamIds.length === 0) {
      return null;
    }

    const teamFilter = {
      OR: [{ homeTeamId: { in: teamIds } }, { awayTeamId: { in: teamIds } }],
    };

    const include = {
      homeTeam: { select: { id: true, name: true } },
      awayTeam: { select: { id: true, name: true } },
      tournament: { select: { name: true, oversPerInnings: true } },
    };

    const liveMatch = await this.prisma.match.findFirst({
      where: { ...teamFilter, state: { in: LIVE_STATES } },
      orderBy: [{ matchDate: 'desc' }, { createdAt: 'desc' }],
      include,
    });

    const match =
      liveMatch ??
      (await this.prisma.match.findFirst({
        where: { ...teamFilter, state: { in: UPCOMING_STATES } },
        orderBy: [{ matchDate: 'asc' }, { createdAt: 'asc' }],
        include,
      })) ??
      (await this.prisma.match.findFirst({
        where: { ...teamFilter, state: { in: PLAYED_STATES } },
        orderBy: [{ matchDate: 'desc' }, { createdAt: 'desc' }],
        include,
      }));

    if (!match) {
      return null;
    }

    return this.buildFeaturedMatch(match);
  }

  private async buildFeaturedMatch(
    match: MatchWithTeams,
  ): Promise<PlayerFeaturedMatchSummary> {
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
    let card: ScorecardResponse | null = null;

    if (!isUpcoming) {
      try {
        card = await this.scorecardReader.build(match);
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

    const infoLine = this.resolveInfoLine(status, match, card);

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

  private resolveInfoLine(
    status: CaptainFeaturedMatchStatus,
    match: MatchWithTeams,
    card: ScorecardResponse | null,
  ): string | null {
    if (status === 'COMPLETED') {
      return null;
    }
    if (status === 'UPCOMING') {
      return this.tossLine(match);
    }
    if (status === 'LIVE' && card) {
      const chaseLine = this.chaseLine(card, match);
      if (chaseLine) {
        return chaseLine;
      }
      return this.tossLine(match);
    }
    return null;
  }

  /** Second-innings chase equation shown as the blue info line on the featured card. */
  private chaseLine(card: ScorecardResponse, match: MatchWithTeams): string | null {
    const normals = card.innings.filter((inn) => inn.inningsType === InningsType.Normal);
    if (normals.length < 2) {
      return null;
    }

    const firstInnings = normals[0]!;
    const chaseInnings = normals[1]!;
    if (chaseInnings.closed) {
      return null;
    }

    const firstInningsTotal = firstInnings.runs;
    const target = card.effectiveTarget ?? firstInningsTotal + 1;
    const runsNeeded = Math.max(0, target - chaseInnings.runs);
    const oversPerInnings =
      chaseInnings.oversAllotted ??
      firstInnings.oversAllotted ??
      match.tournament.oversPerInnings;
    const ballsRemaining = Math.max(
      0,
      oversPerInnings * BALLS_PER_OVER - chaseInnings.legalBalls,
    );

    const homeName = match.homeTeam?.name ?? 'TBD';
    const awayName = match.awayTeam?.name ?? match.externalOpponentName ?? 'TBD';
    const chasingTeamId = chaseInnings.battingTeamId;
    let chasingName = 'Chasing team';
    if (chasingTeamId === match.homeTeamId) {
      chasingName = homeName;
    } else if (chasingTeamId === match.awayTeamId) {
      chasingName = awayName;
    }

    const runWord = runsNeeded === 1 ? 'run' : 'runs';
    const ballWord = ballsRemaining === 1 ? 'ball' : 'balls';
    return `${chasingName} needs ${runsNeeded} ${runWord} from ${ballsRemaining} ${ballWord}`;
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

    const primary = innings[innings.length - 1]!;
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

  private async listTournaments(tournamentIds: string[]): Promise<TournamentSummary[]> {
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
