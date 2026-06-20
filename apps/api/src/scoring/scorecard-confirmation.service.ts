import {
  type AuthUser,
  type ManOfMatchEligibilityView,
  MatchState,
  type ScorecardConfirmationView,
  ScorecardAuditAction,
  SCORECARD_CONFIRM_WINDOW_MS,
  SYSTEM_ACTOR_LABEL,
  UserRole,
  computeManOfMatchDueAt,
  isManOfMatchOverdue,
} from '@acc/types';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Match } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { LiveService } from '../live/live.service';
import { PrismaService } from '../prisma/prisma.service';
import { isCaptainOrViceCaptain } from '../authz/team-leader.util';
import { ScorecardReader } from './scorecard-reader';

/** Match states awaiting a §13.1 confirmation. No Result still locks (§5.2). */
const AWAITING_CONFIRMATION: MatchState[] = [MatchState.Completed, MatchState.NoResult];

/** States in which the Man of the Match may be selected (after the game). */
const POST_MATCH_STATES: MatchState[] = [MatchState.Completed, MatchState.ScorecardLocked];

type MatchWithTournament = Match & { tournament: { type: string } };

const SUSPENDED_STATUSES = ['PENDING', 'CARRIED_FORWARD'] as const;

/**
 * Scorecard confirmation & post-match flow (spec §13). Handles the Captain/VC
 * manual confirmation (§13.1), the 5-hour System auto-confirm (§13.1, §23) used
 * by both the cron sweep and the lazy read-path safety-net, and Man of the
 * Match selection (§13.3). RBAC is enforced at the controller via the existing
 * `@RequirePermission` guard.
 */
@Injectable()
export class ScorecardConfirmationService {
  private readonly logger = new Logger(ScorecardConfirmationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly reader: ScorecardReader,
    private readonly live: LiveService,
  ) {}

  // --- Manual confirmation (§13.1) -----------------------------------------

  async confirm(
    actor: AuthUser,
    matchId: string,
    expectedVersion?: number,
  ): Promise<ScorecardConfirmationView> {
    const match = await this.requireMatch(matchId);
    if ((match.state as MatchState) === MatchState.ScorecardLocked) {
      throw new BadRequestException({
        message: 'The scorecard is already confirmed',
        error: 'SCORECARD_ALREADY_LOCKED',
      });
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

    const locked = await this.lock(match, { actorUserId: actor.id, auto: false });
    await this.audit.record({
      action: ScorecardAuditAction.Confirmed,
      actorUserId: actor.id,
      targetEntityType: 'match',
      targetEntityId: matchId,
      before: { state: match.state },
      after: { state: MatchState.ScorecardLocked, confirmedByUserId: actor.id },
    });
    return this.toView(locked);
  }

  // --- Auto-confirm (§13.1, §23) -------------------------------------------

  /**
   * Lazy safety-net invoked on the scorecard read-path: locks the scorecard if
   * the 5-hour window has elapsed without a manual confirmation. No-op
   * otherwise. Idempotent and never throws on a missing match.
   */
  async evaluateAutoConfirm(matchId: string): Promise<void> {
    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (match && this.autoConfirmDue(match)) {
      await this.autoConfirm(match);
    }
  }

  /** Cron sweep: auto-confirms every match whose window has elapsed. */
  async sweepAutoConfirm(): Promise<number> {
    const cutoff = new Date(Date.now() - SCORECARD_CONFIRM_WINDOW_MS);
    const due = await this.prisma.match.findMany({
      where: {
        state: { in: AWAITING_CONFIRMATION },
        completedAt: { not: null, lte: cutoff },
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
    await this.lock(match, { actorUserId: null, auto: true });
    await this.audit.record({
      action: ScorecardAuditAction.AutoConfirmed,
      actorLabel: SYSTEM_ACTOR_LABEL,
      targetEntityType: 'match',
      targetEntityId: match.id,
      before: { state: match.state },
      after: { state: MatchState.ScorecardLocked, autoConfirmed: true },
    });
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
      match.manOfTheMatchUserId == null &&
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
    return { offered, canSelect, required: offered, dueAt, overdue };
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

  async status(matchId: string): Promise<ScorecardConfirmationView> {
    await this.evaluateAutoConfirm(matchId);
    return this.toView(await this.requireMatch(matchId));
  }

  // --- internals -----------------------------------------------------------

  /**
   * Locks the scorecard: persists the derived winner so the locked card is
   * authoritative, sets the confirmation columns, revokes any lingering Scorer
   * grants, and re-publishes the live snapshot.
   */
  private async lock(
    match: Match,
    by: { actorUserId: string | null; auto: boolean },
  ): Promise<MatchWithTournament> {
    const card = await this.reader.build(match);
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.match.update({
        where: { id: match.id },
        data: {
          state: MatchState.ScorecardLocked,
          confirmedAt: new Date(),
          confirmedByUserId: by.actorUserId,
          autoConfirmed: by.auto,
          winningTeamId: card.result.winningTeamId,
          isNoResult: match.isNoResult || card.result.isNoResult,
        },
        include: { tournament: { select: { type: true } } },
      });
      // §11.1: per-match Scorer grants are revoked once the card is locked.
      await tx.matchScorerGrant.updateMany({
        where: { matchId: match.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return row;
    });
    await this.live.publish(await this.reader.build(updated));
    return updated;
  }

  private async requireMatch(matchId: string): Promise<MatchWithTournament> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { tournament: { select: { type: true } } },
    });
    if (!match) {
      throw new NotFoundException({ message: 'Match not found', error: 'MATCH_NOT_FOUND' });
    }
    return match;
  }

  /** Only the winning team's Captain or Vice-Captain may award MoM (§13.3). */
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

    throw new BadRequestException({
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
    return {
      matchId: match.id,
      state: match.state,
      completedAt: match.completedAt?.toISOString() ?? null,
      confirmedAt: match.confirmedAt?.toISOString() ?? null,
      confirmedByUserId: match.confirmedByUserId,
      autoConfirmed: match.autoConfirmed,
      autoConfirmDueAt: due?.toISOString() ?? null,
      withinConfirmWindow: withinWindow,
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
