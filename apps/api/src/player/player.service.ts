import {
  type CaptainFeaturedMatchStatus,
  deriveChaseEquation,
  formatChaseNeedsLine,
  InningsType,
  isScorerMatchResumable,
  type ManagerPlayerStats,
  MatchState,
  type MatchSummaryTeamView,
  type PlayerDashboard,
  type PlayerFeaturedMatchSummary,
  resolveOversAllotment,
  type ScorerStartableMatch,
  type ScorecardResponse,
  type TournamentSummary,
  TossDecision,
  UserRole,
} from '@acc/types';
import { Injectable } from '@nestjs/common';
import type { Match, Tournament } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { ParticipationPollService } from '../participation-poll/participation-poll.service';
import { activeTournamentRelationWhere, activeTournamentWhere } from '../tournaments/tournament-query';
import {
  formatScorerMatchDateTimeLine,
  isScorerMatchDayToday,
  SCORER_DASHBOARD_CARD_STATES,
  SCORER_IN_PROGRESS_MATCH_STATES,
  SCORER_STARTABLE_MATCH_STATES,
} from '../matches/match-start.utils';
import { ScorecardReader } from '../scoring/scorecard-reader';

type TournamentWithCounts = Tournament & { _count: { teams: number } };

type MatchWithTeams = Match & {
  homeTeam: { id: string; name: string } | null;
  awayTeam: { id: string; name: string } | null;
  tournament: { name: string; oversPerInnings: number | null };
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
    private readonly participationPolls: ParticipationPollService,
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

    const [featuredMatch, participationPoll, scorerMatch, playerStats, tournaments] = await Promise.all([
      this.loadFeaturedMatch(teamIds),
      this.participationPolls.loadDashboardPoll(userId),
      this.loadScorerStartableMatch(userId),
      this.loadPlayerStats(userId, tournamentIds),
      this.listTournaments(tournamentIds),
    ]);

    return { featuredMatch, participationPoll, scorerMatch, playerStats, tournaments };
  }

  /** Active per-match Scorer grant for a fixture on today's calendar day (§11.1). */
  async getScorerMatch(userId: string): Promise<ScorerStartableMatch | null> {
    return this.loadScorerStartableMatch(userId);
  }

  private async loadScorerStartableMatch(userId: string): Promise<ScorerStartableMatch | null> {
    // Requires BOTH an active grant AND today's UTC calendar day on the fixture.
    // Pre-live → Start Match; LIVE / rain-interrupted → Continue Scoring; completed → no card.
    const grants = await this.prisma.matchScorerGrant.findMany({
      where: {
        userId,
        revokedAt: null,
        match: {
          isDeleted: false,
          state: { in: [...SCORER_DASHBOARD_CARD_STATES] },
          ...activeTournamentRelationWhere,
        },
      },
      include: {
        match: {
          include: {
            homeTeam: { select: { id: true, name: true, logoUrl: true } },
            awayTeam: { select: { id: true, name: true, logoUrl: true } },
            tournament: { select: { name: true, timezone: true } },
          },
        },
      },
      orderBy: [{ match: { matchDate: 'asc' } }, { match: { startTime: 'asc' } }],
    });

    const todayGrants = grants.filter((grant) =>
      isScorerMatchDayToday(grant.match, grant.match.tournament.timezone),
    );

    const inProgress = todayGrants.find((grant) =>
      (SCORER_IN_PROGRESS_MATCH_STATES as readonly string[]).includes(grant.match.state),
    );
    if (inProgress) {
      return this.toScorerStartableMatch(inProgress.match);
    }

    const startable = todayGrants.find((grant) =>
      (SCORER_STARTABLE_MATCH_STATES as readonly string[]).includes(grant.match.state),
    );
    if (startable) {
      return this.toScorerStartableMatch(startable.match);
    }

    return null;
  }

  private toScorerStartableMatch(
    match: Match & {
      homeTeam: { id: string; name: string; logoUrl: string | null } | null;
      awayTeam: { id: string; name: string; logoUrl: string | null } | null;
      tournament: { name: string; timezone: string | null };
    },
  ): ScorerStartableMatch {
    const homeName = match.homeTeam?.name ?? 'TBD';
    const awayName = match.awayTeam?.name ?? match.externalOpponentName ?? 'TBD';
    const state = match.state as MatchState;
    return {
      matchId: match.id,
      tournamentName: match.tournament.name.toUpperCase(),
      dateTimeLine: formatScorerMatchDateTimeLine(match, match.tournament.timezone, {
        includeZoneAbbrev: true,
      }),
      teamA: {
        name: homeName,
        logoUrl: match.homeTeam?.logoUrl ?? null,
        score: null,
        overs: null,
        isWinner: false,
      },
      teamB: {
        name: awayName,
        logoUrl: match.awayTeam?.logoUrl ?? null,
        score: null,
        overs: null,
        isWinner: false,
      },
      state,
      playingXiLocked:
        isScorerMatchResumable(state) ||
        state === MatchState.PlayingXiLocked ||
        state === MatchState.TossCompleted ||
        state === MatchState.Delayed,
    };
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
      where: { ...teamFilter, state: { in: LIVE_STATES }, ...activeTournamentRelationWhere },
      orderBy: [{ matchDate: 'desc' }, { createdAt: 'desc' }],
      include,
    });

    const match =
      liveMatch ??
      (await this.prisma.match.findFirst({
        where: { ...teamFilter, state: { in: UPCOMING_STATES }, ...activeTournamentRelationWhere },
        orderBy: [{ matchDate: 'asc' }, { createdAt: 'asc' }],
        include,
      })) ??
      (await this.prisma.match.findFirst({
        where: { ...teamFilter, state: { in: PLAYED_STATES }, ...activeTournamentRelationWhere },
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
    const oversPerInnings = resolveOversAllotment(
      chaseInnings.oversAllotted,
      firstInnings.oversAllotted,
      match.tournament.oversPerInnings,
    );
    if (oversPerInnings == null) {
      return null;
    }
    const chase = deriveChaseEquation(
      chaseInnings.runs,
      chaseInnings.legalBalls,
      target,
      oversPerInnings,
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

    return `${chasingName} ${formatChaseNeedsLine(chase.runsNeeded, chase.ballsRemaining)}`;
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
      where: { id: { in: tournamentIds }, ...activeTournamentWhere },
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
      locationAddress: row.locationAddress,
      latitude: row.latitude,
      longitude: row.longitude,
      timezone: row.timezone,
      teamCount: row._count.teams,
    };
  }
}
