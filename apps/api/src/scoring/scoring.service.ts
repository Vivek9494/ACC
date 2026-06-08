import {
  type AuthUser,
  type DismissalType,
  type EditDeliveryRequest,
  InningsType,
  MatchState,
  type RecordDeliveryRequest,
  ScorecardAuditAction,
  type ScorecardResponse,
  type SetDlsTargetRequest,
  type StartInningsRequest,
  STALE_SCORECARD_ERROR,
  type UpdateOversAllottedRequest,
} from '@acc/types';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Delivery, Innings, Match, Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { LiveService } from '../live/live.service';
import { PrismaService } from '../prisma/prisma.service';
import { toScoringEvent } from './delivery-mapper';
import {
  currentEventPosition,
  currentOverNumber,
  deriveInnings,
  editWindowAllows,
  nextBallPosition,
  occupiesBallSlot,
} from './engine';
import { ScorecardConfirmationService } from './scorecard-confirmation.service';
import { ScorecardReader } from './scorecard-reader';

/** Match states in which normal (live) scoring mutations are accepted. */
const SCORABLE_STATES: MatchState[] = [MatchState.Live, MatchState.RainInterrupted];

/** Options controlling a delivery write. */
interface WriteOptions {
  /**
   * §13.2 post-confirmation correction by Admin / ACC Club Manager: permitted
   * only while the match is `SCORECARD_LOCKED`, exempt from the §12.2 edit
   * window, and audited per edit.
   */
  postConfirm?: boolean;
}

/** A participant-agnostic delivery payload before user/external column splitting. */
interface DeliveryDraft {
  inningsId: string;
  type: string;
  sequence: number;
  overNumber: number | null;
  ballNumber: number | null;
  strikerId: string | null;
  nonStrikerId: string | null;
  bowlerId: string | null;
  runsBat: number;
  extraRuns: number;
  isBoundary: boolean;
  isFreeHit: boolean;
  dismissalType: DismissalType | null;
  dismissedId: string | null;
  fielderId: string | null;
  createdByUserId: string;
  revision?: number;
}

@Injectable()
export class ScoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly live: LiveService,
    private readonly reader: ScorecardReader,
    private readonly audit: AuditService,
    private readonly confirmation: ScorecardConfirmationService,
  ) {}

  // --- Reads ---------------------------------------------------------------

  async getScorecard(matchId: string): Promise<ScorecardResponse> {
    // §13.1 lazy safety-net: if the 5-hour window has elapsed, lock the
    // scorecard before serving (the cron is the primary path).
    await this.confirmation.evaluateAutoConfirm(matchId);
    const match = await this.requireMatch(matchId);
    // Warm the live cache so a subsequent socket subscriber gets a snapshot.
    return this.publishAndReturn(match);
  }

  /** Builds the scorecard, pushes it to live subscribers, and returns it. */
  private async publishAndReturn(match: Match): Promise<ScorecardResponse> {
    const card = await this.reader.build(match);
    await this.live.publish(card);
    return card;
  }

  // --- Innings lifecycle ---------------------------------------------------

  async startInnings(
    _user: AuthUser,
    matchId: string,
    req: StartInningsRequest,
  ): Promise<ScorecardResponse> {
    const match = await this.requireMatch(matchId);
    this.assertVersion(match, req.expectedVersion);
    this.assertScorable(match);

    const existing = await this.prisma.innings.findMany({
      where: { matchId },
      orderBy: { sequence: 'desc' },
      take: 1,
    });
    const nextSequence = (existing[0]?.sequence ?? 0) + 1;

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.innings.create({
        data: {
          matchId,
          sequence: nextSequence,
          inningsType: (req.inningsType ?? InningsType.Normal) as InningsType,
          battingTeamId: req.battingTeamId ?? null,
          bowlingTeamId: req.bowlingTeamId ?? null,
          battingIsExternal: req.battingIsExternal ?? false,
          bowlingIsExternal: req.bowlingIsExternal ?? false,
          oversAllotted: req.oversAllotted ?? null,
        },
      });
      return this.bumpVersion(tx, matchId);
    });

    return this.publishAndReturn(updated);
  }

  // --- Deliveries ----------------------------------------------------------

  async recordDelivery(
    user: AuthUser,
    matchId: string,
    inningsId: string,
    req: RecordDeliveryRequest,
    opts: WriteOptions = {},
  ): Promise<ScorecardResponse> {
    const match = await this.requireMatch(matchId);
    this.assertVersion(match, req.expectedVersion);
    this.assertEditable(match, opts);

    await this.requireInnings(matchId, inningsId);
    const live = await this.liveDeliveries(inningsId);
    const events = live.map((d) => toScoringEvent(d));

    const slot = occupiesBallSlot(req.type);
    const position = slot ? nextBallPosition(events) : currentEventPosition(events);
    // A no-ball arms a free hit that the next legal delivery consumes (§12.1).
    const freeHitNext = deriveInnings(events).freeHitNext;
    const nextSequence = await this.nextSequence(inningsId);

    const data = await this.buildDeliveryData(matchId, {
      inningsId,
      type: req.type,
      sequence: nextSequence,
      overNumber: position.overNumber,
      ballNumber: position.ballNumber,
      strikerId: req.strikerId ?? null,
      nonStrikerId: req.nonStrikerId ?? null,
      bowlerId: req.bowlerId ?? null,
      runsBat: req.runsBat ?? 0,
      extraRuns: req.extraRuns ?? 0,
      isBoundary: req.isBoundary ?? false,
      isFreeHit: slot && req.type === 'LEGAL' ? freeHitNext : false,
      dismissalType: req.dismissal?.type ?? null,
      dismissedId: req.dismissal?.dismissedId ?? null,
      fielderId: req.dismissal?.fielderId ?? null,
      createdByUserId: user.id,
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      const created = await tx.delivery.create({ data });
      if (opts.postConfirm) {
        await this.auditPostConfirm(user, matchId, null, created);
      }
      return this.bumpVersion(tx, matchId);
    });
    return this.publishAndReturn(updated);
  }

  async editDelivery(
    user: AuthUser,
    matchId: string,
    req: EditDeliveryRequest,
    opts: WriteOptions = {},
  ): Promise<ScorecardResponse> {
    const match = await this.requireMatch(matchId);
    this.assertVersion(match, req.expectedVersion);
    this.assertEditable(match, opts);

    const target = await this.prisma.delivery.findUnique({ where: { id: req.deliveryId } });
    if (!target || target.isVoided) {
      throw new NotFoundException({ message: 'Delivery not found', error: 'DELIVERY_NOT_FOUND' });
    }
    const innings = await this.requireInnings(matchId, target.inningsId);

    // Edit window (§12.2): current over and the immediately previous over only.
    // Post-confirmation corrections (§13.2) are exempt — any over is editable.
    if (!opts.postConfirm) {
      const live = await this.liveDeliveries(innings.id);
      const current = currentOverNumber(live.map((d) => toScoringEvent(d)));
      const targetOver = target.overNumber ?? current;
      if (!editWindowAllows(targetOver, current)) {
        throw new BadRequestException({
          message: 'Edits are only allowed to the current over or the immediately previous over',
          error: 'EDIT_WINDOW_CLOSED',
        });
      }
    }

    const nextSequence = await this.nextSequence(innings.id);
    const data = await this.buildDeliveryData(matchId, {
      inningsId: innings.id,
      type: req.type,
      sequence: nextSequence,
      // The correction keeps the original ball's position so the over is intact.
      overNumber: target.overNumber,
      ballNumber: target.ballNumber,
      strikerId: req.strikerId ?? null,
      nonStrikerId: req.nonStrikerId ?? null,
      bowlerId: req.bowlerId ?? null,
      runsBat: req.runsBat ?? 0,
      extraRuns: req.extraRuns ?? 0,
      isBoundary: req.isBoundary ?? false,
      isFreeHit: target.isFreeHit,
      dismissalType: req.dismissal?.type ?? null,
      dismissedId: req.dismissal?.dismissedId ?? null,
      fielderId: req.dismissal?.fielderId ?? null,
      createdByUserId: user.id,
      revision: target.revision + 1,
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      const replacement = await tx.delivery.create({ data });
      await tx.delivery.update({
        where: { id: target.id },
        data: { isVoided: true, supersededByDeliveryId: replacement.id },
      });
      if (opts.postConfirm) {
        await this.auditPostConfirm(user, matchId, target, replacement);
      }
      return this.bumpVersion(tx, matchId);
    });
    return this.publishAndReturn(updated);
  }

  // --- DLS & overs revision ------------------------------------------------

  async setDlsTarget(
    _user: AuthUser,
    matchId: string,
    req: SetDlsTargetRequest,
  ): Promise<ScorecardResponse> {
    const match = await this.requireMatch(matchId);
    this.assertVersion(match, req.expectedVersion);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.match.update({
        where: { id: matchId },
        data: {
          dlsTarget: req.dlsTarget,
          ...(req.originalTarget != null ? { originalTarget: req.originalTarget } : {}),
        },
      });
      return this.bumpVersion(tx, matchId);
    });
    return this.publishAndReturn(updated);
  }

  async setOversAllotted(
    _user: AuthUser,
    matchId: string,
    req: UpdateOversAllottedRequest,
  ): Promise<ScorecardResponse> {
    const match = await this.requireMatch(matchId);
    this.assertVersion(match, req.expectedVersion);
    const innings = await this.requireInnings(matchId, req.inningsId);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.innings.update({
        where: { id: innings.id },
        data: { oversAllotted: req.oversAllotted },
      });
      return this.bumpVersion(tx, matchId);
    });
    return this.publishAndReturn(updated);
  }

  // --- Mapping helpers -----------------------------------------------------

  /**
   * Resolves each opaque participant id to either a system user column or an
   * external-player column (ACC opponents are external — §9.5) and produces a
   * Prisma `Delivery` create payload.
   */
  private async buildDeliveryData(
    matchId: string,
    draft: DeliveryDraft,
  ): Promise<Prisma.DeliveryUncheckedCreateInput> {
    const externals = await this.prisma.externalPlayer.findMany({ where: { matchId } });
    const externalIds = new Set(externals.map((e) => e.id));
    const isExternal = (id: string | null): boolean => id != null && externalIds.has(id);

    const userCol = (id: string | null): string | null => (id && !isExternal(id) ? id : null);
    const extCol = (id: string | null): string | null => (id && isExternal(id) ? id : null);

    return {
      inningsId: draft.inningsId,
      type: draft.type as Prisma.DeliveryUncheckedCreateInput['type'],
      sequence: draft.sequence,
      overNumber: draft.overNumber,
      ballNumber: draft.ballNumber,
      strikerUserId: userCol(draft.strikerId),
      strikerExternalId: extCol(draft.strikerId),
      nonStrikerUserId: userCol(draft.nonStrikerId),
      nonStrikerExternalId: extCol(draft.nonStrikerId),
      bowlerUserId: userCol(draft.bowlerId),
      bowlerExternalId: extCol(draft.bowlerId),
      runsBat: draft.runsBat,
      extraRuns: draft.extraRuns,
      isBoundary: draft.isBoundary,
      isFreeHit: draft.isFreeHit,
      dismissalType: draft.dismissalType,
      dismissedUserId: userCol(draft.dismissedId),
      dismissedExternalId: extCol(draft.dismissedId),
      fielderUserId: userCol(draft.fielderId),
      fielderExternalId: extCol(draft.fielderId),
      revision: draft.revision ?? 1,
      createdByUserId: draft.createdByUserId,
    };
  }

  // --- Internals -----------------------------------------------------------

  private async liveDeliveries(inningsId: string): Promise<Delivery[]> {
    return this.prisma.delivery.findMany({
      where: { inningsId, isVoided: false },
      orderBy: { sequence: 'asc' },
    });
  }

  private async nextSequence(inningsId: string): Promise<number> {
    const last = await this.prisma.delivery.findFirst({
      where: { inningsId },
      orderBy: { sequence: 'desc' },
    });
    return (last?.sequence ?? 0) + 1;
  }

  private async bumpVersion(tx: Prisma.TransactionClient, matchId: string): Promise<Match> {
    return tx.match.update({
      where: { id: matchId },
      data: { scorecardVersion: { increment: 1 } },
    });
  }

  /** §18.1: every post-confirmation scorecard edit is logged with before/after. */
  private async auditPostConfirm(
    user: AuthUser,
    matchId: string,
    before: Delivery | null,
    after: Delivery,
  ): Promise<void> {
    await this.audit.record({
      action: ScorecardAuditAction.PostConfirmEdit,
      actorUserId: user.id,
      targetEntityType: 'delivery',
      targetEntityId: after.id,
      before: before ? this.deliverySnapshot(before) : undefined,
      after: this.deliverySnapshot(after),
      details: { matchId },
    });
  }

  private deliverySnapshot(d: Delivery): Prisma.InputJsonValue {
    return {
      id: d.id,
      sequence: d.sequence,
      overNumber: d.overNumber,
      ballNumber: d.ballNumber,
      type: d.type,
      runsBat: d.runsBat,
      extraRuns: d.extraRuns,
      isBoundary: d.isBoundary,
      dismissalType: d.dismissalType,
    };
  }

  private assertVersion(match: Match, expected: number): void {
    if (match.scorecardVersion !== expected) {
      // §12.3: the exact, user-facing concurrency message.
      throw new ConflictException({
        message: STALE_SCORECARD_ERROR,
        error: 'SCORECARD_VERSION_CONFLICT',
      });
    }
  }

  private assertScorable(match: Match): void {
    if (!SCORABLE_STATES.includes(match.state as MatchState)) {
      throw new BadRequestException({
        message: 'The match is not live; scoring is not allowed in its current state',
        error: 'MATCH_NOT_LIVE',
      });
    }
  }

  /** Gates a delivery write: live scoring vs. a §13.2 post-confirmation edit. */
  private assertEditable(match: Match, opts: WriteOptions): void {
    if (opts.postConfirm) {
      if ((match.state as MatchState) !== MatchState.ScorecardLocked) {
        throw new BadRequestException({
          message: 'Post-confirmation edits are only allowed on a locked scorecard',
          error: 'SCORECARD_NOT_LOCKED',
        });
      }
      return;
    }
    this.assertScorable(match);
  }

  private async requireMatch(matchId: string): Promise<Match> {
    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (!match) {
      throw new NotFoundException({ message: 'Match not found', error: 'MATCH_NOT_FOUND' });
    }
    return match;
  }

  private async requireInnings(matchId: string, inningsId: string): Promise<Innings> {
    const innings = await this.prisma.innings.findUnique({ where: { id: inningsId } });
    if (!innings || innings.matchId !== matchId) {
      throw new NotFoundException({ message: 'Innings not found', error: 'INNINGS_NOT_FOUND' });
    }
    return innings;
  }
}
