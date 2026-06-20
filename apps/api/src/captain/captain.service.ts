import {
  type AuthUser,
  type CaptainDashboard,
  type CaptainFeaturedMatchStatus,
  type CaptainFeaturedMatchSummary,
  type CaptainPendingManOfMatch,
  type CaptainScorerAssignmentMatch,
  type CaptainUpcomingMatchCardView,
  type ManagerPlayerStats,
  MatchState,
  type MatchSummaryTeamView,
  Permission,
  type TournamentSummary,
  TossDecision,
  TournamentType,
  UserRole,
  computeManOfMatchDueAt,
  isAssignScorerButtonVisible,
  isConfirmedListButtonVisible,
  isManOfMatchOverdue,
  isViewPunchTimeButtonVisible,
  serverVenueTimezone,
} from '@acc/types';
import { Injectable } from '@nestjs/common';
import type { Match, Tournament } from '@prisma/client';

import { PermissionService } from '../authz/permission.service';
import { isCaptainOrViceCaptain } from '../authz/team-leader.util';
import { ParticipationPollService } from '../participation-poll/participation-poll.service';
import { PrismaService } from '../prisma/prisma.service';
import { activeTournamentRelationWhere, activeTournamentWhere } from '../tournaments/tournament-query';
import { canShowScorerAssignmentCard } from '../matches/scorer-assignment.utils';
import { ScorecardReader } from '../scoring/scorecard-reader';
import {
  formatScorerMatchDateTimeLine,
  isScorerMatchDayToday,
  SCORER_STARTABLE_MATCH_STATES,
} from '../matches/match-start.utils';

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

const XI_BUTTON_MATCH_STATES: MatchState[] = [
  MatchState.Scheduled,
  MatchState.Delayed,
  MatchState.PlayingXiLocked,
  MatchState.TossCompleted,
];

@Injectable()
export class CaptainService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scorecardReader: ScorecardReader,
    private readonly permissions: PermissionService,
    private readonly participationPolls: ParticipationPollService,
  ) {}

  async getDashboard(actor: AuthUser): Promise<CaptainDashboard> {
    const userId = actor.id;
    const leadership = await this.prisma.roleAssignment.findMany({
      where: {
        userId,
        role: { in: [UserRole.Captain, UserRole.ViceCaptain] },
      },
      select: { teamId: true, tournamentId: true, role: true },
    });

    const teamIds = [
      ...new Set(leadership.map((row) => row.teamId).filter((id): id is string => Boolean(id))),
    ];
    const tournamentIds = [
      ...new Set(
        leadership.map((row) => row.tournamentId).filter((id): id is string => Boolean(id)),
      ),
    ];

    const leadershipTeamIds = [
      ...new Set(
        leadership
          .map((row) => row.teamId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const [featuredMatch, captainPollCards, pendingManOfMatch, scorerAssignmentMatch, playerStats, tournaments] =
      await Promise.all([
      this.loadFeaturedMatch(teamIds),
      this.participationPolls.loadCaptainDashboardCards(userId),
      this.loadPendingManOfMatch(userId, teamIds),
      this.loadScorerAssignmentMatch(actor, teamIds),
      this.loadPlayerStats(userId, tournamentIds),
      this.listTeamTournaments(tournamentIds),
    ]);

    const upcomingMatchCard = await this.buildUpcomingMatchCard(
      leadershipTeamIds,
      captainPollCards,
      scorerAssignmentMatch,
    );

    return {
      featuredMatch,
      upcomingMatchCard,
      participationPoll: upcomingMatchCard ? null : captainPollCards.participationPoll,
      playingXiCard: null,
      punchTimeCard: null,
      pendingManOfMatch,
      scorerAssignmentMatch: upcomingMatchCard ? null : scorerAssignmentMatch,
      playerStats,
      tournaments,
    };
  }

  /** Captain / VC unified upcoming leather match card (poll + prep actions). */
  private async buildUpcomingMatchCard(
    leadershipTeamIds: string[],
    pollCards: {
      participationPoll: CaptainDashboard['participationPoll'];
      playingXiCard: CaptainDashboard['playingXiCard'];
    },
    scorerAssignment: CaptainScorerAssignmentMatch | null,
  ): Promise<CaptainUpcomingMatchCardView | null> {
    if (leadershipTeamIds.length === 0) {
      return null;
    }

    const poll = pollCards.participationPoll;
    const xi = pollCards.playingXiCard;
    const source = poll ?? xi;
    if (!source) {
      return null;
    }

    if (!leadershipTeamIds.includes(source.teamId)) {
      return null;
    }

    const match = await this.prisma.match.findFirst({
      where: { id: source.matchId, isDeleted: false },
      select: {
        id: true,
        matchDate: true,
        startTime: true,
        reportingTime: true,
        state: true,
        tournament: { select: { timezone: true } },
      },
    });
    if (!match) {
      return null;
    }

    const now = new Date();
    const scheduleZone = serverVenueTimezone(match.tournament.timezone);
    const pollClosed = poll != null ? !poll.isOpen : xi != null;
    const matchAnchor = {
      matchDate: match.matchDate,
      startTime: match.startTime,
    };

    const showConfirmedList =
      xi != null &&
      pollClosed &&
      XI_BUTTON_MATCH_STATES.includes(match.state as MatchState) &&
      isConfirmedListButtonVisible(matchAnchor, pollClosed, scheduleZone, now);

    const scorerForMatch =
      scorerAssignment?.matchId === source.matchId ? scorerAssignment : null;
    const showAssignScorer =
      scorerForMatch != null &&
      isAssignScorerButtonVisible(matchAnchor, scheduleZone, now);

    const showViewPunchTime =
      match.reportingTime != null &&
      isViewPunchTimeButtonVisible({ reportingTime: match.reportingTime }, now);

    return {
      matchId: source.matchId,
      teamId: source.teamId,
      tournamentName: source.tournamentName,
      dateTimeLine: source.dateTimeLine,
      venue: source.venue,
      matchTitle: source.matchTitle,
      participationPoll: poll,
      playingXiEntry: xi
        ? { pollId: xi.pollId, hasSavedSquad: xi.hasSavedSquad }
        : null,
      scorerAssignment: showAssignScorer ? scorerForMatch : null,
      actions: {
        showConfirmedList,
        showAssignScorer,
        showViewPunchTime,
      },
    };
  }

  /**
   * Pre-live fixture in the scorer-assignment window (§11.1) for which the actor
   * may assign/switch the per-match Scorer.
   */
  private async loadScorerAssignmentMatch(
    actor: AuthUser,
    teamIds: string[],
  ): Promise<CaptainScorerAssignmentMatch | null> {
    if (teamIds.length === 0) {
      return null;
    }

    const matches = await this.prisma.match.findMany({
      where: {
        OR: [{ homeTeamId: { in: teamIds } }, { awayTeamId: { in: teamIds } }],
        state: { in: [...SCORER_STARTABLE_MATCH_STATES] },
        isDeleted: false,
        ...activeTournamentRelationWhere,
      },
      include: {
        homeTeam: { select: { id: true, name: true, logoUrl: true } },
        awayTeam: { select: { id: true, name: true, logoUrl: true } },
        tournament: { select: { name: true, type: true, timezone: true } },
        scorerGrants: {
          where: { revokedAt: null },
          orderBy: { grantedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ matchDate: 'asc' }, { startTime: 'asc' }],
    });

    for (const match of matches) {
      if (!isScorerMatchDayToday(match, match.tournament.timezone)) {
        continue;
      }

      const permission =
        match.tournament.type === TournamentType.ACC
          ? Permission.ASSIGN_MATCH_SCORER
          : Permission.ASSIGN_TOURNAMENT_SCORER;
      const allowed = await this.permissions.check(permission, actor, { matchId: match.id });
      if (!allowed) {
        continue;
      }

      const activeGrant = match.scorerGrants[0] ?? null;
      if (!canShowScorerAssignmentCard(actor.id, activeGrant)) {
        continue;
      }

      const homeName = match.homeTeam?.name ?? 'TBD';
      const awayName = match.awayTeam?.name ?? match.externalOpponentName ?? 'TBD';
      let assignedScorer: CaptainScorerAssignmentMatch['assignedScorer'] = null;
      if (activeGrant) {
        const user = await this.prisma.user.findUnique({
          where: { id: activeGrant.userId },
          select: { id: true, firstName: true, lastName: true },
        });
        if (user) {
          assignedScorer = {
            userId: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
          };
        }
      }

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
        assignedScorer,
      };
    }

    return null;
  }

  private async loadPendingManOfMatch(
    userId: string,
    teamIds: string[],
  ): Promise<CaptainPendingManOfMatch | null> {
    if (teamIds.length === 0) {
      return null;
    }

    const matches = await this.prisma.match.findMany({
      where: {
        OR: [{ homeTeamId: { in: teamIds } }, { awayTeamId: { in: teamIds } }],
        state: { in: [MatchState.Completed, MatchState.ScorecardLocked] },
        manOfTheMatchUserId: null,
        winningTeamId: { in: teamIds },
        ...activeTournamentRelationWhere,
      },
      orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
      take: 10,
      include: {
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
      },
    });

    for (const match of matches) {
      const winningTeamId = match.winningTeamId;
      if (!winningTeamId) {
        continue;
      }
      try {
        const card = await this.scorecardReader.build(match);
        if (!card.result.decided || card.result.isTie) {
          continue;
        }
      } catch {
        continue;
      }
      if (!(await this.isWinningTeamLeader(userId, match, winningTeamId))) {
        continue;
      }
      const teamName =
        winningTeamId === match.homeTeamId
          ? (match.homeTeam?.name ?? 'Home')
          : (match.awayTeam?.name ?? 'Away');
      const dueAt = computeManOfMatchDueAt(
        match.matchDate?.toISOString() ?? null,
        match.completedAt?.toISOString() ?? null,
      );
      return {
        matchId: match.id,
        teamName,
        resultLine: match.resultNote,
        required: true,
        dueAt,
        overdue: isManOfMatchOverdue(dueAt, null),
      };
    }
    return null;
  }

  private async isWinningTeamLeader(
    userId: string,
    match: Match & { tournamentId: string },
    winningTeamId: string,
  ): Promise<boolean> {
    const tournamentId = match.tournamentId;
    if (await isCaptainOrViceCaptain(this.prisma, userId, tournamentId, winningTeamId)) {
      return true;
    }

    const leaders = await this.prisma.roleAssignment.findMany({
      where: { teamId: winningTeamId, role: { in: [UserRole.Captain, UserRole.ViceCaptain] } },
      select: { userId: true, role: true },
    });
    const captainId = leaders.find((row) => row.role === UserRole.Captain)?.userId;
    const viceCaptainId = leaders.find((row) => row.role === UserRole.ViceCaptain)?.userId;

    const isSuspended = async (leaderId: string | undefined): Promise<boolean> => {
      if (!leaderId) {
        return false;
      }
      const suspension = await this.prisma.suspension.findFirst({
        where: {
          userId: leaderId,
          status: { in: ['PENDING', 'CARRIED_FORWARD'] },
          servingMatchId: match.id,
        },
        select: { id: true },
      });
      return suspension !== null;
    };

    const captainSuspended = await isSuspended(captainId);
    const viceCaptainSuspended = await isSuspended(viceCaptainId);
    const leadersSuspended =
      captainId !== undefined &&
      viceCaptainId !== undefined &&
      captainSuspended &&
      viceCaptainSuspended;
    if (leadersSuspended) {
      const isClubManager = await this.prisma.roleAssignment.findFirst({
        where: { userId, role: UserRole.ClubManager, tournamentId },
        select: { id: true },
      });
      return isClubManager !== null;
    }
    return false;
  }

  private async loadFeaturedMatch(teamIds: string[]): Promise<CaptainFeaturedMatchSummary | null> {
    if (teamIds.length === 0) {
      return null;
    }

    const teamFilter = {
      OR: [{ homeTeamId: { in: teamIds } }, { awayTeamId: { in: teamIds } }],
    };

    const liveMatch = await this.prisma.match.findFirst({
      where: { ...teamFilter, state: { in: LIVE_STATES }, ...activeTournamentRelationWhere },
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
        where: { ...teamFilter, state: { in: UPCOMING_STATES }, ...activeTournamentRelationWhere },
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
