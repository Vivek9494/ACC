import {
  type AuthUser,
  MatchState,
  type ScorecardConfirmationView,
  ScorecardAuditAction,
  SCORECARD_CONFIRM_WINDOW_MS,
  SYSTEM_ACTOR_LABEL,
  TournamentType,
} from '@acc/types';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Match } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { LiveService } from '../live/live.service';
import { PrismaService } from '../prisma/prisma.service';
import { ScorecardReader } from './scorecard-reader';

/** Match states awaiting a §13.1 confirmation. No Result still locks (§5.2). */
const AWAITING_CONFIRMATION: MatchState[] = [MatchState.Completed, MatchState.NoResult];

/** States in which the Man of the Match may be selected (after the game). */
const POST_MATCH_STATES: MatchState[] = [MatchState.Completed, MatchState.ScorecardLocked];

type MatchWithTournament = Match & { tournament: { type: string } };

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

    const inSquad = await this.prisma.matchSquadPlayer.findFirst({
      where: { userId, squad: { matchId } },
      select: { id: true },
    });
    if (!inSquad) {
      throw new BadRequestException({
        message: 'Man of the Match must be a player from the match squads',
        error: 'PLAYER_NOT_IN_MATCH',
      });
    }

    // §13.3: for ACC matches the award is made only when the ACC team wins, so
    // require a decided result (not a tie/No Result).
    if ((match.tournament.type as TournamentType) === TournamentType.ACC) {
      const card = await this.reader.build(match);
      if (match.isNoResult || card.result.isNoResult || !card.result.decided) {
        throw new BadRequestException({
          message: 'Man of the Match can be selected only when the ACC team wins',
          error: 'ACC_NO_WINNER',
        });
      }
    }

    const updated = await this.prisma.match.update({
      where: { id: matchId },
      data: { manOfTheMatchUserId: userId },
      include: { tournament: { select: { type: true } } },
    });
    await this.audit.record({
      action: ScorecardAuditAction.ManOfMatchSelected,
      actorUserId: actor.id,
      targetUserId: userId,
      targetEntityType: 'match',
      targetEntityId: matchId,
      after: { manOfTheMatchUserId: userId },
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

  private toView(match: Match): ScorecardConfirmationView {
    const due = match.completedAt
      ? new Date(match.completedAt.getTime() + SCORECARD_CONFIRM_WINDOW_MS)
      : null;
    const withinWindow =
      AWAITING_CONFIRMATION.includes(match.state as MatchState) &&
      due !== null &&
      Date.now() < due.getTime();
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
      winningTeamId: match.winningTeamId,
      isNoResult: match.isNoResult,
    };
  }
}
