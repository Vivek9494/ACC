import {
  type CaptainFeaturedMatchStatus,
  type CaptainFeaturedMatchSummary,
  deriveChaseEquation,
  formatChaseNeedsLine,
  formatUtcIsoDate,
  HomeAway,
  InningsType,
  MatchState,
  type MatchSummaryTeamView,
  resolveOversAllotment,
  type ScorecardResponse,
  TossDecision,
} from '@acc/types';
import { Injectable } from '@nestjs/common';
import type { Match } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { ScorecardReader } from '../scoring/scorecard-reader';
import { activeTournamentRelationWhere } from '../tournaments/tournament-query';
import { filterDashboardFeaturedMatchesToToday, sortAndLimitDashboardTodayMatchRows } from './dashboard-featured-match.utils';
import { withDashboardMatchVisibility } from './match-visibility.utils';

type MatchWithTeams = Match & {
  homeTeam: { id: string; name: string } | null;
  awayTeam: { id: string; name: string } | null;
  tournament: { name: string; oversPerInnings: number | null; timezone: string | null };
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

const FEATURED_MATCH_INCLUDE = {
  homeTeam: { select: { id: true, name: true } },
  awayTeam: { select: { id: true, name: true } },
  tournament: { select: { name: true, oversPerInnings: true, timezone: true } },
} as const;

/**
 * App-wide today's fixtures for role home dashboards — all tournaments/teams, no per-user filter.
 */
@Injectable()
export class DashboardFeaturedMatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scorecardReader: ScorecardReader,
  ) {}

  async loadTodayMatches(): Promise<CaptainFeaturedMatchSummary[]> {
    const rows = await this.prisma.match.findMany({
      where: withDashboardMatchVisibility({
        state: { in: [...LIVE_STATES, ...UPCOMING_STATES, ...PLAYED_STATES] },
        ...activeTournamentRelationWhere,
      }),
      include: FEATURED_MATCH_INCLUDE,
    });

    const todayRows = filterDashboardFeaturedMatchesToToday(rows);
    const topTodayRows = sortAndLimitDashboardTodayMatchRows(todayRows);
    return Promise.all(topTodayRows.map((row) => this.buildFeaturedMatch(row)));
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
      homeAway: (match.homeAway as HomeAway | null) ?? null,
      matchDate: match.matchDate ? formatUtcIsoDate(match.matchDate) : null,
      startTime: match.startTime?.toISOString() ?? null,
      tournamentTimezone: match.tournament.timezone,
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
}
