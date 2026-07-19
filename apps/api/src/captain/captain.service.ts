import {
  BallType,
  type AuthUser,
  type CaptainDashboard,
  type CaptainFeaturedMatchSummary,
  type CaptainPendingManOfMatch,
  type CaptainScorerAssignmentMatch,
  type CaptainUpcomingMatchCardView,
  type ParticipationPollCardView,
  MatchState,
  Permission,
  TournamentType,
  UserRole,
  canViewCaptainDashboardPunchTimeButton,
  computeManOfMatchDueAt,
  isAssignScorerButtonVisible,
  isCaptainUpcomingMatchCardVisible,
  isConfirmedListButtonVisible,
  isManOfMatchOverdue,
  replaceGenericHomeAwayInResultNote,
  serverVenueTimezone,
} from '@acc/types';
import { Injectable } from '@nestjs/common';
import type { Match } from '@prisma/client';

import { PermissionService } from '../authz/permission.service';
import { isCaptainOrViceCaptain } from '../authz/team-leader.util';
import { ScorerDashboardMatchService } from '../matches/scorer-dashboard-match.service';
import { DashboardFeaturedMatchesService } from '../matches/dashboard-featured-matches.service';
import { ParticipationPollService } from '../participation-poll/participation-poll.service';
import { PlayerStatsService } from '../player-stats/player-stats.service';
import { PrismaService } from '../prisma/prisma.service';
import { TournamentsService } from '../tournaments/tournaments.service';
import { activeTournamentRelationWhere } from '../tournaments/tournament-query';
import { canShowScorerAssignmentCard } from '../matches/scorer-assignment.utils';
import { ScorecardReader } from '../scoring/scorecard-reader';
import { ScorecardConfirmationService } from '../scoring/scorecard-confirmation.service';
import {
  formatScorerMatchDateTimeLine,
  isScorerMatchDayToday,
  SCORER_STARTABLE_MATCH_STATES,
} from '../matches/match-start.utils';

const UPCOMING_STATES: MatchState[] = [
  MatchState.Scheduled,
  MatchState.PlayingXiLocked,
  MatchState.TossCompleted,
  MatchState.Delayed,
];

const LIVE_STATES: MatchState[] = [MatchState.Live, MatchState.RainInterrupted];

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
    private readonly playerStatsService: PlayerStatsService,
    private readonly scorerDashboardMatch: ScorerDashboardMatchService,
    private readonly scorecardConfirmation: ScorecardConfirmationService,
    private readonly dashboardFeaturedMatches: DashboardFeaturedMatchesService,
    private readonly tournaments: TournamentsService,
  ) {}

  async loadSquadParticipationPoll(userId: string): Promise<ParticipationPollCardView | null> {
    return this.participationPolls.loadDashboardPoll(userId);
  }

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

    const [featuredMatchesRaw, teamLeadMatchCards, squadParticipationPoll, pendingManOfMatch, pendingScorecardConfirmations, scorerMatch, playerStats, tournaments] =
      await Promise.all([
      this.dashboardFeaturedMatches.loadTodayMatches(),
      this.loadTeamLeadMatchCards(actor),
      this.loadSquadParticipationPoll(userId),
      this.loadPendingManOfMatch(userId, teamIds),
      this.scorecardConfirmation.listPendingDashboardConfirmations(actor),
      this.scorerDashboardMatch.loadStartableMatch(userId),
      this.playerStatsService.buildDashboardHighLevelStats(userId),
      this.tournaments.listDashboardSummaries(actor),
    ]);

    const featuredMatches = scorerMatch
      ? featuredMatchesRaw.filter((match) => match.matchId !== scorerMatch.matchId)
      : featuredMatchesRaw;

    const { upcomingMatchCard, scorerAssignmentMatch } = teamLeadMatchCards;
    const participationPoll = upcomingMatchCard ? null : squadParticipationPoll;

    return {
      featuredMatches,
      upcomingMatchCard,
      participationPoll,
      playingXiCard: null,
      punchTimeCard: null,
      pendingManOfMatch,
      pendingScorecardConfirmations,
      scorerAssignmentMatch: upcomingMatchCard ? null : scorerAssignmentMatch,
      scorerMatch,
      playerStats,
      tournaments,
    };
  }

  /**
   * Participation poll and upcoming-match prep cards for any user with Captain/VC
   * team assignments (including Club Managers who captain an ACC team).
   */
  async loadTeamLeadMatchCards(actor: AuthUser): Promise<{
    upcomingMatchCard: CaptainUpcomingMatchCardView | null;
    participationPoll: ParticipationPollCardView | null;
    scorerAssignmentMatch: CaptainScorerAssignmentMatch | null;
  }> {
    const leadership = await this.prisma.roleAssignment.findMany({
      where: {
        userId: actor.id,
        role: { in: [UserRole.Captain, UserRole.ViceCaptain] },
      },
      select: { teamId: true },
    });
    const leadershipTeamIds = [
      ...new Set(
        leadership.map((row) => row.teamId).filter((id): id is string => Boolean(id)),
      ),
    ];
    if (leadershipTeamIds.length === 0) {
      return {
        upcomingMatchCard: null,
        participationPoll: null,
        scorerAssignmentMatch: null,
      };
    }

    const [captainPollCards, scorerAssignmentMatch] = await Promise.all([
      this.participationPolls.loadCaptainDashboardCards(actor.id),
      this.loadScorerAssignmentMatch(actor, leadershipTeamIds),
    ]);

    const upcomingMatchCard = await this.buildUpcomingMatchCard(
      actor,
      leadershipTeamIds,
      captainPollCards,
      scorerAssignmentMatch,
    );

    return {
      upcomingMatchCard,
      participationPoll: null,
      scorerAssignmentMatch: upcomingMatchCard ? null : scorerAssignmentMatch,
    };
  }

  /** Captain / VC unified upcoming leather match card (poll + prep actions). */
  private async buildUpcomingMatchCard(
    actor: AuthUser,
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
        tournamentId: true,
        homeTeamId: true,
        awayTeamId: true,
        matchDate: true,
        startTime: true,
        reportingTime: true,
        state: true,
        tournament: { select: { timezone: true, ballType: true, createdByUserId: true } },
      },
    });
    if (!match) {
      return null;
    }

    const now = new Date();
    const scheduleZone = serverVenueTimezone(match.tournament.timezone);
    const matchAnchor = {
      matchDate: match.matchDate,
      startTime: match.startTime,
    };
    if (!isCaptainUpcomingMatchCardVisible(matchAnchor, scheduleZone, now)) {
      return null;
    }

    const pollClosed = poll != null ? !poll.isOpen : xi != null;

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

    const showViewPunchTime = canViewCaptainDashboardPunchTimeButton(
      actor,
      {
        ballType: match.tournament.ballType as BallType,
        state: match.state as MatchState,
        tournamentId: match.tournamentId,
        tournamentCreatedByUserId: match.tournament.createdByUserId,
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        reportingTime: match.reportingTime,
      },
      now,
    );

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
      const homeName = match.homeTeam?.name ?? 'Home';
      const awayName = match.awayTeam?.name ?? match.externalOpponentName ?? 'Away';
      const teamName =
        winningTeamId === match.homeTeamId
          ? homeName
          : match.awayTeamId != null && winningTeamId === match.awayTeamId
            ? awayName
            : homeName;
      const dueAt = computeManOfMatchDueAt(
        match.matchDate?.toISOString() ?? null,
        match.completedAt?.toISOString() ?? null,
      );
      return {
        matchId: match.id,
        teamName,
        resultLine: match.resultNote
          ? replaceGenericHomeAwayInResultNote(match.resultNote, homeName, awayName)
          : match.resultNote,
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
}
