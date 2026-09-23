import {
  type AuthUser,
  BallType,
  type CaptainFeaturedMatchStatus,
  type CaptainFeaturedMatchSummary,
  deriveChaseEquation,
  formatChaseNeedsLine,
  formatMatchResultNote,
  formatUtcIsoDate,
  HomeAway,
  InningsType,
  MatchState,
  type MatchSummaryTeamView,
  replaceGenericHomeAwayInResultNote,
  resolveMatchWinnerDisplayName,
  resolveOversAllotment,
  type ScorecardResponse,
  TossDecision,
} from '@acc/types';
import { Injectable } from '@nestjs/common';
import type { Match } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { ScorecardReader } from '../scoring/scorecard-reader';
import {
  activeTournamentRelationWhere,
  guestVisibleTournamentRelationWhere,
} from '../tournaments/tournament-query';
import { LeatherTournamentVisibilityService } from '../tournaments/leather-tournament-visibility.service';
import {
  dashboardRecentMatchDateCutoff,
  excludeUnplayedMatchesInCompletedTournaments,
  filterDashboardUpcomingMatchesBySchedule,
  filterDashboardRecentMatchesByMatchDate,
  sortAndLimitDashboardTodayMatchRows,
  sortDashboardMatchesByTimeDesc,
} from './dashboard-featured-match.utils';
import { withDashboardMatchVisibility } from './match-visibility.utils';

type MatchWithTeams = Match & {
  homeTeam: { id: string; name: string } | null;
  awayTeam: { id: string; name: string } | null;
  tournament: {
    name: string;
    oversPerInnings: number | null;
    timezone: string | null;
    startAt: Date;
    endAt: Date;
    ballType: string;
  };
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

const FEATURED_MATCH_INCLUDE = {
  homeTeam: { select: { id: true, name: true } },
  awayTeam: { select: { id: true, name: true } },
  tournament: {
    select: {
      name: true,
      oversPerInnings: true,
      timezone: true,
      startAt: true,
      endAt: true,
      ballType: true,
    },
  },
} as const;

/**
 * Dashboard Live + Upcoming featured matches for guest and all role homes.
 * Guests: Tennis only. Logged-in: Tennis + leather tournaments they may view.
 */
@Injectable()
export class DashboardFeaturedMatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scorecardReader: ScorecardReader,
    private readonly leatherVisibility: LeatherTournamentVisibilityService,
  ) {}

  /**
   * Currently live fixtures (`LIVE` / `RAIN_INTERRUPTED`), not date-windowed.
   * `viewer` null → guest (tennis only).
   */
  async loadLiveMatches(
    viewer: AuthUser | null = null,
  ): Promise<CaptainFeaturedMatchSummary[]> {
    const rows = await this.prisma.match.findMany({
      where: withDashboardMatchVisibility({
        suppressLiveSideEffects: false,
        state: { in: LIVE_STATES },
        ...(viewer
          ? activeTournamentRelationWhere
          : guestVisibleTournamentRelationWhere),
      }),
      include: FEATURED_MATCH_INCLUDE,
    });
    const scoped = await this.filterRowsForAudience(viewer, rows);
    const sorted = sortAndLimitDashboardTodayMatchRows(scoped, scoped.length);
    return Promise.all(sorted.map((row) => this.buildFeaturedMatch(row)));
  }

  /**
   * Pre-play fixtures in `(now, now+7d]`, soonest→latest. Applies Rule 1
   * (hide unplayed matches in Completed tournaments).
   * `viewer` null → guest (tennis only).
   */
  async loadUpcomingMatches(
    viewer: AuthUser | null = null,
    now: Date = new Date(),
  ): Promise<CaptainFeaturedMatchSummary[]> {
    const rows = await this.prisma.match.findMany({
      where: withDashboardMatchVisibility({
        state: { in: UPCOMING_STATES },
        ...(viewer
          ? activeTournamentRelationWhere
          : guestVisibleTournamentRelationWhere),
      }),
      include: FEATURED_MATCH_INCLUDE,
    });
    const scoped = await this.filterRowsForAudience(viewer, rows);
    const upcoming = filterDashboardUpcomingMatchesBySchedule(
      excludeUnplayedMatchesInCompletedTournaments(scoped, now),
      now,
    );
    const sorted = sortAndLimitDashboardTodayMatchRows(upcoming, upcoming.length);
    return Promise.all(sorted.map((row) => this.buildFeaturedMatch(row)));
  }

  /** Most recently completed Tennis fixture (guest home recent card; Leather excluded). */
  async loadGuestMostRecentCompletedMatch(
    now: Date = new Date(),
  ): Promise<CaptainFeaturedMatchSummary | null> {
    const cutoff = dashboardRecentMatchDateCutoff(now);
    const rows = await this.prisma.match.findMany({
      where: withDashboardMatchVisibility({
        state: { in: COMPLETED_STATES },
        matchDate: { gte: new Date(`${cutoff}T00:00:00.000Z`) },
        ...guestVisibleTournamentRelationWhere,
      }),
      include: FEATURED_MATCH_INCLUDE,
    });
    const [recent] = sortDashboardMatchesByTimeDesc(
      filterDashboardRecentMatchesByMatchDate(rows, now),
    );
    return recent ? this.buildFeaturedMatch(recent) : null;
  }

  /**
   * Guests: tennis rows only (query already scoped).
   * Logged-in: all tennis + leather IDs from {@link LeatherTournamentVisibilityService}.
   */
  private async filterRowsForAudience<T extends MatchWithTeams>(
    viewer: AuthUser | null,
    rows: T[],
  ): Promise<T[]> {
    if (!viewer) {
      return rows.filter((row) => row.tournament.ballType === BallType.Tennis);
    }

    const tennisRows = rows.filter((row) => row.tournament.ballType === BallType.Tennis);
    const leatherRows = rows.filter((row) => row.tournament.ballType === BallType.Leather);
    if (leatherRows.length === 0) {
      return tennisRows;
    }

    const visibleLeatherIds = new Set(
      await this.leatherVisibility.getVisibleLeatherTournamentIds(viewer),
    );
    return [
      ...tennisRows,
      ...leatherRows.filter((row) => visibleLeatherIds.has(row.tournamentId)),
    ];
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

        if (status === 'COMPLETED' && !card.result.isNoResult) {
          const winnerName = resolveMatchWinnerDisplayName(
            {
              homeTeamId: match.homeTeamId,
              awayTeamId: match.awayTeamId,
              homeTeamName: homeName,
              awayTeamName: match.awayTeam?.name,
              externalOpponentName: match.externalOpponentName,
            },
            card.result,
            card.innings,
          );
          resultLine = formatMatchResultNote(winnerName, card.result);
          if (!resultLine && match.resultNote) {
            resultLine = replaceGenericHomeAwayInResultNote(
              match.resultNote,
              homeName,
              awayName,
            );
          }
        }
      } catch {
        // Scorecard not yet available — keep rows without scores.
      }
    }

    const infoLine = this.resolveInfoLine(status, match, card);

    return {
      matchId: match.id,
      tournamentId: match.tournamentId,
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
