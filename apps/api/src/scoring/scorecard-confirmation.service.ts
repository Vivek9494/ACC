import {
  type AuthUser,
  type ManOfMatchEligibilityView,
  MatchState,
  type ScorecardConfirmEligibilityView,
  ScorecardConfirmSide,
  type ScorecardConfirmationView,
  type PendingScorecardConfirmationCardView,
  ScorecardAuditAction,
  SCORECARD_CONFIRM_WINDOW_MS,
  SYSTEM_ACTOR_LABEL,
  type TeamScorecardConfirmationView,
  UserRole,
  computeManOfMatchDueAt,
  hasPlayerMomMatchFigures,
  isManOfMatchOverdue,
  isScorecardFinalized,
  isScorecardLocked,
} from '@acc/types';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Match } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { KnockoutProgressionService } from '../knockout-bracket/knockout-progression.service';
import { LiveService } from '../live/live.service';
import { NotificationAudienceService } from '../notifications/notification-audience.service';
import {
  NotificationsService,
  NotificationTrigger,
} from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { activeMatchFirstWhere } from '../matches/match-query';
import { isCaptainOrViceCaptain } from '../authz/team-leader.util';
import { ScorecardReader } from './scorecard-reader';

/** Match states awaiting a §13.1 confirmation. No Result still locks (§5.2). */
const AWAITING_CONFIRMATION: MatchState[] = [MatchState.Completed, MatchState.NoResult];

/** States in which the Man of the Match may be selected (after the game). */
const POST_MATCH_STATES: MatchState[] = [MatchState.Completed, MatchState.ScorecardLocked];

type MatchWithTournament = Match & { tournament: { type: string } };

const SUSPENDED_STATUSES = ['PENDING', 'CARRIED_FORWARD'] as const;

/**
 * Scorecard confirmation & post-match flow (spec §13). Two-sided confirmation:
 * each participating team's Captain/VC confirms their own side; Admin/Club Manager
 * may finalize outright; the 5-hour System auto-confirm finalizes both sides.
 */
@Injectable()
export class ScorecardConfirmationService {
  private readonly logger = new Logger(ScorecardConfirmationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly reader: ScorecardReader,
    private readonly live: LiveService,
    private readonly knockoutProgression: KnockoutProgressionService,
    private readonly notifications: NotificationsService,
    private readonly notificationAudience: NotificationAudienceService,
  ) {}

  // --- Manual confirmation (§13.1) -----------------------------------------

  async confirm(
    actor: AuthUser,
    matchId: string,
    expectedVersion?: number,
  ): Promise<ScorecardConfirmationView> {
    const match = await this.requireMatch(matchId);
    if (isScorecardLocked(match)) {
      return this.toView(match);
    }
    if (!AWAITING_CONFIRMATION.includes(match.state as MatchState)) {
      throw new BadRequestException({
        message: 'The match is not awaiting scorecard confirmation',
        error: 'NOT_AWAITING_CONFIRMATION',
      });
    }
    if (expectedVersion !== undefined && match.scorecardVersion !== expectedVersion) {
      throw new BadRequestException({
        message: 'Scorecard got updated.',
        error: 'SCORECARD_VERSION_CONFLICT',
      });
    }

    const side = await this.resolveConfirmSide(actor, match);
    if (!side) {
      throw new ForbiddenException({
        message:
          'Only the Captain or Vice-Captain of a participating team, Admin, or Club Manager may confirm the scorecard',
        error: 'FORBIDDEN',
      });
    }

    if (isScorecardFinalized(match)) {
      return this.toView(match);
    }

    const now = new Date();
    let updated = match;

    if (side === ScorecardConfirmSide.Admin) {
      if (!match.adminConfirmed) {
        updated = await this.prisma.match.update({
          where: { id: matchId },
          data: {
            adminConfirmed: true,
            adminConfirmedByUserId: actor.id,
            adminConfirmedAt: now,
          },
          include: { tournament: { select: { type: true } } },
        });
      }
    } else if (side === ScorecardConfirmSide.Home) {
      if (!match.homeTeamConfirmed) {
        updated = await this.prisma.match.update({
          where: { id: matchId },
          data: {
            homeTeamConfirmed: true,
            homeTeamConfirmedByUserId: actor.id,
            homeTeamConfirmedAt: now,
          },
          include: { tournament: { select: { type: true } } },
        });
      }
    } else if (side === ScorecardConfirmSide.Away) {
      if (!match.awayTeamConfirmed) {
        updated = await this.prisma.match.update({
          where: { id: matchId },
          data: {
            awayTeamConfirmed: true,
            awayTeamConfirmedByUserId: actor.id,
            awayTeamConfirmedAt: now,
          },
          include: { tournament: { select: { type: true } } },
        });
      }
    }

    await this.audit.record({
      action: ScorecardAuditAction.Confirmed,
      actorUserId: actor.id,
      targetEntityType: 'match',
      targetEntityId: matchId,
      before: {
        homeTeamConfirmed: match.homeTeamConfirmed,
        awayTeamConfirmed: match.awayTeamConfirmed,
        adminConfirmed: match.adminConfirmed,
      },
      after: {
        confirmSide: side,
        homeTeamConfirmed: updated.homeTeamConfirmed,
        awayTeamConfirmed: updated.awayTeamConfirmed,
        adminConfirmed: updated.adminConfirmed,
      },
    });

    if (isScorecardFinalized(updated)) {
      updated = await this.lock(updated, { actorUserId: actor.id, auto: false });
    }

    return this.toView(updated);
  }

  // --- Auto-confirm (§13.1, §23) -------------------------------------------

  async evaluateAutoConfirm(matchId: string): Promise<void> {
    const match = await this.prisma.match.findFirst({ where: activeMatchFirstWhere(matchId) });
    if (match && this.autoConfirmDue(match)) {
      await this.autoConfirm(match);
    }
  }

  async sweepAutoConfirm(): Promise<number> {
    const cutoff = new Date(Date.now() - SCORECARD_CONFIRM_WINDOW_MS);
    const due = await this.prisma.match.findMany({
      where: {
        state: { in: AWAITING_CONFIRMATION },
        completedAt: { not: null, lte: cutoff },
        isDeleted: false,
      },
    });
    for (const match of due) {
      await this.autoConfirm(match);
    }
    if (due.length > 0) {
      this.logger.log(`Auto-confirmed ${due.length} scorecard(s) past the 5-hour window`);
    }
    return due.length;
  }

  private autoConfirmDue(match: Match): boolean {
    if (!AWAITING_CONFIRMATION.includes(match.state as MatchState) || !match.completedAt) {
      return false;
    }
    return Date.now() - match.completedAt.getTime() >= SCORECARD_CONFIRM_WINDOW_MS;
  }

  private async autoConfirm(match: Match): Promise<void> {
    const claimed = await this.prisma.match.updateMany({
      where: {
        id: match.id,
        isDeleted: false,
        state: { in: AWAITING_CONFIRMATION },
        autoConfirmed: false,
      },
      data: {
        homeTeamConfirmed: true,
        awayTeamConfirmed: true,
      },
    });
    if (claimed.count === 0) {
      return;
    }

    const withBothSides = await this.prisma.match.findFirst({
      where: activeMatchFirstWhere(match.id),
      include: { tournament: { select: { type: true } } },
    });
    if (!withBothSides) {
      return;
    }

    const locked = await this.lock(withBothSides, { actorUserId: null, auto: true });
    await this.audit.record({
      action: ScorecardAuditAction.AutoConfirmed,
      actorLabel: SYSTEM_ACTOR_LABEL,
      targetEntityType: 'match',
      targetEntityId: match.id,
      before: { state: match.state },
      after: { scorecardLocked: true, autoConfirmed: true },
    });
    return void locked;
  }

  // --- Man of the Match (§13.3) --------------------------------------------

  async manOfMatchEligibility(
    actor: AuthUser,
    matchId: string,
  ): Promise<ManOfMatchEligibilityView> {
    const match = await this.requireMatch(matchId);
    const card = await this.reader.build(match);
    const winningTeamId = card.result.winningTeamId;
    const offered =
      POST_MATCH_STATES.includes(match.state as MatchState) &&
      !match.isNoResult &&
      !card.result.isNoResult &&
      card.result.decided &&
      !card.result.isTie &&
      winningTeamId != null;

    let canSelect = false;
    if (offered && winningTeamId) {
      try {
        await this.assertWinningTeamLeader(actor, match, winningTeamId);
        canSelect = true;
      } catch {
        canSelect = false;
      }
    }
    const dueAt = this.manOfMatchDueAt(match);
    const overdue = isManOfMatchOverdue(dueAt, match.manOfTheMatchUserId);
    const required = offered && match.manOfTheMatchUserId == null;
    return { offered, canSelect, required, dueAt, overdue };
  }

  async selectManOfMatch(
    actor: AuthUser,
    matchId: string,
    userId: string,
  ): Promise<ScorecardConfirmationView> {
    const match = await this.requireMatch(matchId);
    if (!POST_MATCH_STATES.includes(match.state as MatchState)) {
      throw new BadRequestException({
        message: 'Man of the Match can only be selected after the match is completed',
        error: 'NOT_POST_MATCH',
      });
    }

    const card = await this.reader.build(match);
    if (match.isNoResult || card.result.isNoResult || !card.result.decided || card.result.isTie) {
      throw new BadRequestException({
        message: 'Man of the Match can only be selected when there is a decided winner',
        error: 'NO_DECIDED_WINNER',
      });
    }

    const winningTeamId = card.result.winningTeamId;
    if (!winningTeamId) {
      throw new BadRequestException({
        message:
          'Man of the Match cannot be selected when the winning team has no registered players',
        error: 'EXTERNAL_WINNER',
      });
    }

    const inWinningSquad = await this.prisma.matchSquadPlayer.findFirst({
      where: {
        userId,
        squad: { matchId, teamId: winningTeamId },
      },
      select: { id: true },
    });
    if (!inWinningSquad) {
      throw new BadRequestException({
        message: 'Man of the Match must be a player from the winning team',
        error: 'PLAYER_NOT_ON_WINNING_TEAM',
      });
    }

    if (!hasPlayerMomMatchFigures(card, userId)) {
      throw new BadRequestException({
        message: 'Man of the Match must be a player who batted or bowled in this match',
        error: 'PLAYER_NO_MATCH_FIGURES',
      });
    }

    await this.assertWinningTeamLeader(actor, match, winningTeamId);

    const updated = await this.prisma.match.update({
      where: { id: matchId },
      data: {
        manOfTheMatchUserId: userId,
        manOfTheMatchSelectedAt: new Date(),
        manOfTheMatchSelectedByUserId: actor.id,
      },
      include: { tournament: { select: { type: true } } },
    });
    await this.audit.record({
      action: ScorecardAuditAction.ManOfMatchSelected,
      actorUserId: actor.id,
      targetUserId: userId,
      targetEntityType: 'match',
      targetEntityId: matchId,
      after: {
        manOfTheMatchUserId: userId,
        manOfTheMatchSelectedByUserId: actor.id,
      },
    });
    return this.toView(updated);
  }

  // --- Status read ---------------------------------------------------------

  async confirmEligibility(
    actor: AuthUser,
    matchId: string,
  ): Promise<ScorecardConfirmEligibilityView> {
    const match = await this.requireMatch(matchId);
    const awaitingConfirmation = AWAITING_CONFIRMATION.includes(match.state as MatchState);
    const finalized = isScorecardFinalized(match);
    const homeTeam = this.teamConfirmationView(match, 'home');
    const awayTeam = this.teamConfirmationView(match, 'away');

    if (!awaitingConfirmation || finalized) {
      return {
        awaitingConfirmation,
        canConfirm: false,
        confirmSide: null,
        scorecardFinalized: finalized,
        homeTeam,
        awayTeam,
        adminConfirmed: match.adminConfirmed,
      };
    }

    const side = await this.resolveConfirmSide(actor, match);
    let canConfirm = false;
    if (side === ScorecardConfirmSide.Admin) {
      canConfirm = true;
    } else if (side === ScorecardConfirmSide.Home) {
      canConfirm = !match.homeTeamConfirmed;
    } else if (side === ScorecardConfirmSide.Away) {
      canConfirm = !match.awayTeamConfirmed;
    }

    return {
      awaitingConfirmation: true,
      canConfirm,
      confirmSide: canConfirm ? side : null,
      scorecardFinalized: finalized,
      homeTeam,
      awayTeam,
      adminConfirmed: match.adminConfirmed,
    };
  }

  async status(matchId: string): Promise<ScorecardConfirmationView> {
    await this.evaluateAutoConfirm(matchId);
    return this.toView(await this.requireMatch(matchId));
  }

  /**
   * Captain/VC dashboard cards — own-team pending confirmations only (§13.1).
   * Excludes Admin/Club Manager override path; those users confirm on the scorecard.
   */
  async listPendingDashboardConfirmations(
    actor: AuthUser,
  ): Promise<PendingScorecardConfirmationCardView[]> {
    const leadership = await this.prisma.roleAssignment.findMany({
      where: {
        userId: actor.id,
        role: { in: [UserRole.Captain, UserRole.ViceCaptain] },
      },
      select: { teamId: true },
    });
    const teamIds = [
      ...new Set(
        leadership.map((row) => row.teamId).filter((id): id is string => Boolean(id)),
      ),
    ];
    if (teamIds.length === 0) {
      return [];
    }

    const matches = await this.prisma.match.findMany({
      where: {
        state: { in: AWAITING_CONFIRMATION },
        adminConfirmed: false,
        OR: [{ homeTeamId: { in: teamIds } }, { awayTeamId: { in: teamIds } }],
      },
      include: {
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
        tournament: { select: { name: true, type: true } },
      },
      orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
    });

    const results: PendingScorecardConfirmationCardView[] = [];
    for (const match of matches) {
      if (isScorecardFinalized(match)) {
        continue;
      }
      const side = await this.resolveCaptainConfirmSide(actor, match);
      if (!side) {
        continue;
      }
      const due = match.completedAt
        ? new Date(match.completedAt.getTime() + SCORECARD_CONFIRM_WINDOW_MS).toISOString()
        : null;
      results.push({
        matchId: match.id,
        tournamentName: match.tournament.name,
        homeTeamName: match.homeTeam?.name ?? 'Home',
        awayTeamName: match.awayTeam?.name ?? match.externalOpponentName ?? 'Away',
        confirmSide: side,
        homeTeamConfirmed: match.homeTeamConfirmed,
        awayTeamConfirmed: match.awayTeamConfirmed,
        autoConfirmDueAt: due,
      });
    }
    return results;
  }

  // --- internals -----------------------------------------------------------

  private async resolveConfirmSide(
    actor: AuthUser,
    match: MatchWithTournament,
  ): Promise<ScorecardConfirmSide | null> {
    if (actor.role === UserRole.Admin) {
      return ScorecardConfirmSide.Admin;
    }

    const tournamentId = match.tournamentId;
    const clubManager = await this.prisma.roleAssignment.findFirst({
      where: {
        userId: actor.id,
        role: UserRole.ClubManager,
        tournamentId,
      },
      select: { id: true },
    });
    if (clubManager) {
      return ScorecardConfirmSide.Admin;
    }

    if (
      match.homeTeamId &&
      (await isCaptainOrViceCaptain(this.prisma, actor.id, tournamentId, match.homeTeamId))
    ) {
      return ScorecardConfirmSide.Home;
    }

    if (
      match.awayTeamId &&
      (await isCaptainOrViceCaptain(this.prisma, actor.id, tournamentId, match.awayTeamId))
    ) {
      return ScorecardConfirmSide.Away;
    }

    return null;
  }

  /** Captain/VC own-team side when their confirmation is still pending. */
  private async resolveCaptainConfirmSide(
    actor: AuthUser,
    match: MatchWithTournament,
  ): Promise<typeof ScorecardConfirmSide.Home | typeof ScorecardConfirmSide.Away | null> {
    const tournamentId = match.tournamentId;
    if (
      match.homeTeamId &&
      !match.homeTeamConfirmed &&
      (await isCaptainOrViceCaptain(this.prisma, actor.id, tournamentId, match.homeTeamId))
    ) {
      return ScorecardConfirmSide.Home;
    }
    if (
      match.awayTeamId &&
      !match.awayTeamConfirmed &&
      (await isCaptainOrViceCaptain(this.prisma, actor.id, tournamentId, match.awayTeamId))
    ) {
      return ScorecardConfirmSide.Away;
    }
    return null;
  }

  private teamConfirmationView(
    match: Match,
    side: 'home' | 'away',
  ): TeamScorecardConfirmationView {
    if (side === 'home') {
      return {
        teamId: match.homeTeamId,
        confirmed: match.homeTeamConfirmed,
        confirmedByUserId: match.homeTeamConfirmedByUserId,
        confirmedAt: match.homeTeamConfirmedAt?.toISOString() ?? null,
      };
    }
    return {
      teamId: match.awayTeamId,
      confirmed: match.awayTeamConfirmed,
      confirmedByUserId: match.awayTeamConfirmedByUserId,
      confirmedAt: match.awayTeamConfirmedAt?.toISOString() ?? null,
    };
  }

  private async lock(
    match: Match,
    by: { actorUserId: string | null; auto: boolean },
  ): Promise<MatchWithTournament> {
    const card = await this.reader.build(match);
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.match.update({
        where: { id: match.id },
        data: {
          confirmedAt: new Date(),
          confirmedByUserId: by.actorUserId,
          autoConfirmed: by.auto,
          winningTeamId: card.result.winningTeamId,
          isNoResult: match.isNoResult || card.result.isNoResult,
        },
        include: { tournament: { select: { type: true } } },
      });
      await tx.matchScorerGrant.updateMany({
        where: { matchId: match.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.knockoutProgression.advanceWinnerOnConfirmation(tx, {
        id: row.id,
        tournamentId: row.tournamentId,
        bracketId: row.bracketId,
        isDeleted: row.isDeleted,
        winningTeamId: row.winningTeamId,
        isNoResult: row.isNoResult,
        nextMatchId: row.nextMatchId,
        nextMatchSlot: row.nextMatchSlot,
      });
      return row;
    });
    await this.live.publish(await this.reader.build(updated));
    await this.notifyWinningSquad(updated);
    return updated;
  }

  /**
   * §17 Phase B: on scorecard confirmation (lock), congratulate the winning
   * team's squad. Winner is re-derived incl. Super Over/tie-breaks into
   * `winningTeamId`; ties, no-results, and external (unregistered) winners have
   * a null `winningTeamId` and are skipped. Deduped per match so a post-confirm
   * edit that re-locks won't re-send. Best-effort — never fails confirmation.
   */
  private async notifyWinningSquad(match: MatchWithTournament): Promise<void> {
    const winningTeamId = match.winningTeamId;
    if (winningTeamId == null || match.isNoResult) {
      return;
    }
    try {
      const userIds = await this.notificationAudience.resolveTeamSquad(winningTeamId);
      if (userIds.length === 0) {
        return;
      }
      const team = await this.prisma.team.findUnique({
        where: { id: winningTeamId },
        select: { name: true },
      });
      const teamName = team?.name ?? 'Your team';
      await this.notifications.sendToAudience(userIds, {
        triggerKey: NotificationTrigger.MatchResultConfirmed,
        dedupeKey: `${NotificationTrigger.MatchResultConfirmed}:${match.id}`,
        title: 'Match result confirmed',
        body: `Congratulations! ${teamName} won. Tap to view the scorecard.`,
        data: { matchId: match.id, teamId: winningTeamId, screen: 'match' },
        audienceSummary: `Winning squad of match ${match.id}`,
      });
    } catch (err) {
      this.logger.error(
        `Failed to send match-result notification for ${match.id}`,
        err as Error,
      );
    }
  }

  private async requireMatch(matchId: string): Promise<MatchWithTournament> {
    const match = await this.prisma.match.findFirst({
      where: activeMatchFirstWhere(matchId),
      include: { tournament: { select: { type: true } } },
    });
    if (!match) {
      throw new NotFoundException({ message: 'Match not found', error: 'MATCH_NOT_FOUND' });
    }
    return match;
  }

  private async assertWinningTeamLeader(
    actor: AuthUser,
    match: MatchWithTournament,
    winningTeamId: string,
  ): Promise<void> {
    const tournamentId = match.tournamentId;
    if (await isCaptainOrViceCaptain(this.prisma, actor.id, tournamentId, winningTeamId)) {
      return;
    }

    const { leadersSuspended } = await this.leaderSuspensionFacts(winningTeamId, match.id);
    if (leadersSuspended) {
      const isClubManager = await this.prisma.roleAssignment.findFirst({
        where: {
          userId: actor.id,
          role: UserRole.ClubManager,
          tournamentId,
        },
        select: { id: true },
      });
      if (isClubManager) {
        return;
      }
    }

    throw new ForbiddenException({
      message: 'Only the winning team Captain or Vice-Captain may select the Man of the Match',
      error: 'NOT_WINNING_CAPTAIN',
    });
  }

  private async leaderSuspensionFacts(
    teamId: string,
    matchId: string,
  ): Promise<{ captainSuspended: boolean; leadersSuspended: boolean }> {
    const leaders = await this.prisma.roleAssignment.findMany({
      where: { teamId, role: { in: [UserRole.Captain, UserRole.ViceCaptain] } },
      select: { userId: true, role: true },
    });
    const captainId = leaders.find((row) => row.role === UserRole.Captain)?.userId;
    const viceCaptainId = leaders.find((row) => row.role === UserRole.ViceCaptain)?.userId;

    const isSuspended = async (userId: string | undefined): Promise<boolean> => {
      if (!userId) {
        return false;
      }
      const suspension = await this.prisma.suspension.findFirst({
        where: {
          userId,
          status: { in: [...SUSPENDED_STATUSES] },
          servingMatchId: matchId,
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
    return { captainSuspended, leadersSuspended };
  }

  private manOfMatchDueAt(match: Match): string | null {
    return computeManOfMatchDueAt(
      match.matchDate?.toISOString() ?? null,
      match.completedAt?.toISOString() ?? null,
    );
  }

  private toView(match: Match): ScorecardConfirmationView {
    const due = match.completedAt
      ? new Date(match.completedAt.getTime() + SCORECARD_CONFIRM_WINDOW_MS)
      : null;
    const withinWindow =
      AWAITING_CONFIRMATION.includes(match.state as MatchState) &&
      due !== null &&
      Date.now() < due.getTime();
    const manOfMatchDueAt = this.manOfMatchDueAt(match);
    const finalized = isScorecardFinalized(match);
    return {
      matchId: match.id,
      state: match.state,
      completedAt: match.completedAt?.toISOString() ?? null,
      confirmedAt: match.confirmedAt?.toISOString() ?? null,
      confirmedByUserId: match.confirmedByUserId,
      autoConfirmed: match.autoConfirmed,
      autoConfirmDueAt: due?.toISOString() ?? null,
      withinConfirmWindow: withinWindow,
      scorecardFinalized: finalized,
      homeTeamConfirmed: match.homeTeamConfirmed,
      homeTeamConfirmedByUserId: match.homeTeamConfirmedByUserId,
      homeTeamConfirmedAt: match.homeTeamConfirmedAt?.toISOString() ?? null,
      awayTeamConfirmed: match.awayTeamConfirmed,
      awayTeamConfirmedByUserId: match.awayTeamConfirmedByUserId,
      awayTeamConfirmedAt: match.awayTeamConfirmedAt?.toISOString() ?? null,
      adminConfirmed: match.adminConfirmed,
      adminConfirmedByUserId: match.adminConfirmedByUserId,
      adminConfirmedAt: match.adminConfirmedAt?.toISOString() ?? null,
      manOfTheMatchUserId: match.manOfTheMatchUserId,
      manOfTheMatchSelectedAt: match.manOfTheMatchSelectedAt?.toISOString() ?? null,
      manOfTheMatchSelectedByUserId: match.manOfTheMatchSelectedByUserId,
      manOfMatchDueAt,
      manOfMatchOverdue: isManOfMatchOverdue(manOfMatchDueAt, match.manOfTheMatchUserId),
      winningTeamId: match.winningTeamId,
      isNoResult: match.isNoResult,
    };
  }
}
