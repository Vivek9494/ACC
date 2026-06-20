import {
  type AuthUser,
  type DismissalType,
  DeliveryType,
  type EditDeliveryRequest,
  type EndInningsRequest,
  InningsType,
  MatchState,
  minimumOversAllotmentFromLegalBalls,
  SUPER_OVER_OVERS,
  formatMatchResultNote,
  type RecordDeliveryRequest,
  ScorecardAuditAction,
  type ScorecardResponse,
  type SetDlsTargetRequest,
  type StartInningsRequest,
  STALE_SCORECARD_ERROR,
  type SetInningsParticipantsRequest,
  type UndoDeliveryRequest,
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
  inningsAcceptsDelivery,
  isConsecutiveOverViolation,
  isDismissalAllowedOnFreeHit,
  isLegalBall,
  nextBallPosition,
  occupiesBallSlot,
  type ScoringEvent,
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
  noBallByeRuns: number;
  noBallLegByeRuns: number;
  penaltyBeneficiaryTeamId: string | null;
  isBoundary: boolean;
  isFreeHit: boolean;
  dismissalType: DismissalType | null;
  dismissedId: string | null;
  fielderId: string | null;
  fielder2Id: string | null;
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

    this.assertCanAppendDelivery(events, req);

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
      noBallByeRuns: req.noBallByeRuns ?? 0,
      noBallLegByeRuns: req.noBallLegByeRuns ?? 0,
      penaltyBeneficiaryTeamId: req.penaltyBeneficiaryTeamId ?? null,
      isBoundary: req.isBoundary ?? false,
      isFreeHit: slot && req.type === 'LEGAL' ? freeHitNext : false,
      dismissalType:
        req.type === DeliveryType.RetiredHurt ? null : (req.dismissal?.type ?? null),
      dismissedId: req.dismissal?.dismissedId ?? null,
      fielderId: req.fielderId ?? req.dismissal?.fielderId ?? null,
      fielder2Id: req.dismissal?.fielder2Id ?? null,
      createdByUserId: user.id,
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      const created = await tx.delivery.create({ data });
      const postEvents = [...events, toScoringEvent(created)];
      const priorDerived = deriveInnings(events);
      const derived = deriveInnings(postEvents);
      const participantClear: Prisma.InningsUpdateInput = {
        selectedStrikerUserId: null,
        selectedStrikerExternalId: null,
        selectedNonStrikerUserId: null,
        selectedNonStrikerExternalId: null,
      };
      const overJustCompleted =
        isLegalBall(req.type) &&
        derived.legalBalls > priorDerived.legalBalls &&
        derived.legalBalls > 0 &&
        derived.legalBalls % 6 === 0;
      if (overJustCompleted) {
        participantClear.selectedBowlerUserId = null;
        participantClear.selectedBowlerExternalId = null;
      }
      await tx.innings.update({ where: { id: inningsId }, data: participantClear });
      if (opts.postConfirm) {
        await this.auditPostConfirm(user, matchId, null, created);
      }
      if (req.type === DeliveryType.PenaltyRuns) {
        await this.audit.record({
          action: 'PENALTY_RUNS_AWARDED',
          actorUserId: user.id,
          targetEntityType: 'delivery',
          targetEntityId: created.id,
          after: {
            matchId,
            inningsId,
            beneficiaryTeamId: req.penaltyBeneficiaryTeamId ?? null,
            runs: req.extraRuns ?? 0,
          },
        });
      }
      return this.bumpVersion(tx, matchId);
    });
    return this.publishAndReturn(updated);
  }

  /** Undo the last appended delivery by voiding it; all figures re-derive (§12.1). */
  async undoLastDelivery(
    _user: AuthUser,
    matchId: string,
    inningsId: string,
    req: UndoDeliveryRequest,
  ): Promise<ScorecardResponse> {
    const match = await this.requireMatch(matchId);
    this.assertVersion(match, req.expectedVersion);
    this.assertEditable(match, {});

    await this.requireInnings(matchId, inningsId);
    const live = await this.liveDeliveries(inningsId);
    if (live.length === 0) {
      throw new BadRequestException({
        message: 'There is no delivery to undo',
        error: 'NOTHING_TO_UNDO',
      });
    }

    const last = live.at(-1)!;
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.delivery.update({
        where: { id: last.id },
        data: { isVoided: true },
      });
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
      noBallByeRuns: req.noBallByeRuns ?? 0,
      noBallLegByeRuns: req.noBallLegByeRuns ?? 0,
      penaltyBeneficiaryTeamId: req.penaltyBeneficiaryTeamId ?? null,
      isBoundary: req.isBoundary ?? false,
      isFreeHit: target.isFreeHit,
      dismissalType: req.dismissal?.type ?? null,
      dismissedId: req.dismissal?.dismissedId ?? null,
      fielderId: req.fielderId ?? req.dismissal?.fielderId ?? null,
      fielder2Id: req.dismissal?.fielder2Id ?? null,
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
    user: AuthUser,
    matchId: string,
    req: SetDlsTargetRequest,
  ): Promise<ScorecardResponse> {
    const match = await this.requireMatch(matchId);
    this.assertVersion(match, req.expectedVersion);
    await this.assertChaseTargetCanBeRevised(matchId);

    const priorDls = match.dlsTarget;
    const priorOriginal = match.originalTarget;

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
    await this.audit.record({
      action: 'DLS_TARGET_SET',
      actorUserId: user.id,
      targetEntityType: 'match',
      targetEntityId: matchId,
      before: {
        originalTarget: priorOriginal,
        dlsTarget: priorDls,
      },
      after: {
        originalTarget: req.originalTarget ?? priorOriginal,
        dlsTarget: req.dlsTarget,
      },
    });
    return this.publishAndReturn(updated);
  }

  /** Chase target edits are only valid once the first innings is complete (§12.2). */
  private async assertChaseTargetCanBeRevised(matchId: string): Promise<void> {
    const innings = await this.prisma.innings.findMany({
      where: { matchId, inningsType: InningsType.Normal },
      orderBy: { sequence: 'asc' },
    });
    if (innings.length < 2) {
      throw new BadRequestException({
        message:
          'Target can only be changed during the second innings. The first innings is still in progress.',
        error: 'CHASE_NOT_STARTED',
      });
    }
    const firstId = innings[0]!.id;
    const firstDeliveries = await this.liveDeliveries(firstId);
    const firstDerived = deriveInnings(firstDeliveries.map((d) => toScoringEvent(d)));
    if (!firstDerived.closed) {
      throw new BadRequestException({
        message:
          'Target can only be changed during the second innings. The first innings is still in progress.',
        error: 'FIRST_INNINGS_ACTIVE',
      });
    }
  }

  async setOversAllotted(
    user: AuthUser,
    matchId: string,
    req: UpdateOversAllottedRequest,
  ): Promise<ScorecardResponse> {
    const match = await this.requireMatch(matchId);
    this.assertVersion(match, req.expectedVersion);
    this.assertScorable(match);

    const innings = await this.requireInnings(matchId, req.inningsId);
    const live = await this.liveDeliveries(innings.id);
    const events = live.map((d) => toScoringEvent(d));
    const derived = deriveInnings(events);

    if (!inningsAcceptsDelivery(events)) {
      throw new BadRequestException({
        message: 'Cannot revise overs for a closed innings',
        error: 'INNINGS_CLOSED',
      });
    }

    const minOvers = minimumOversAllotmentFromLegalBalls(derived.legalBalls);
    if (req.oversAllotted < minOvers) {
      throw new BadRequestException({
        message: `Total overs cannot be less than overs already bowled (${minOvers}).`,
        error: 'OVERS_BELOW_BOWLED',
      });
    }

    const normalInnings = await this.prisma.innings.findMany({
      where: { matchId, inningsType: InningsType.Normal },
      orderBy: { sequence: 'asc' },
    });
    const isFirstInnings = normalInnings.length > 0 && normalInnings[0]?.id === innings.id;
    const chaseInnings = isFirstInnings && normalInnings.length >= 2 ? normalInnings[1]! : null;

    const priorOvers = innings.oversAllotted;
    const priorChaseOvers = chaseInnings?.oversAllotted ?? null;

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.innings.update({
        where: { id: innings.id },
        data: { oversAllotted: req.oversAllotted },
      });
      if (chaseInnings) {
        await tx.innings.update({
          where: { id: chaseInnings.id },
          data: { oversAllotted: req.oversAllotted },
        });
      }
      return this.bumpVersion(tx, matchId);
    });

    await this.audit.record({
      action: 'OVERS_ALLOTTED_REVISED',
      actorUserId: user.id,
      targetEntityType: 'innings',
      targetEntityId: innings.id,
      before: {
        oversAllotted: priorOvers,
        ...(chaseInnings ? { chaseInningsOversAllotted: priorChaseOvers } : {}),
      },
      after: {
        oversAllotted: req.oversAllotted,
        matchId,
        ...(chaseInnings
          ? { cascadedToInningsId: chaseInnings.id, chaseInningsOversAllotted: req.oversAllotted }
          : {}),
      },
    });
    return this.publishAndReturn(updated);
  }

  /**
   * End the current innings and run the chase or match-completion transition (§12.2).
   * Works for manual end (appends END_INNINGS) and natural closure (all out / overs / target).
   */
  async endInnings(
    user: AuthUser,
    matchId: string,
    inningsId: string,
    req: EndInningsRequest,
  ): Promise<ScorecardResponse> {
    const match = await this.requireMatch(matchId);
    this.assertVersion(match, req.expectedVersion);
    this.assertScorable(match);

    const innings = await this.requireInnings(matchId, inningsId);
    const allInnings = await this.prisma.innings.findMany({
      where: { matchId },
      orderBy: { sequence: 'asc' },
    });
    const normalInnings = allInnings.filter((row) => row.inningsType === InningsType.Normal);
    const isFirstInnings =
      normalInnings.length >= 1 && normalInnings[0]?.id === inningsId && normalInnings.length === 1;

    if (!isFirstInnings && normalInnings.length >= 2 && (match.state as MatchState) === MatchState.Completed) {
      throw new BadRequestException({
        message: 'The match is already completed',
        error: 'MATCH_ALREADY_COMPLETED',
      });
    }

    if (!isFirstInnings && normalInnings.length >= 2 && normalInnings[0]?.id === inningsId) {
      throw new BadRequestException({
        message: 'The chase innings has already started',
        error: 'CHASE_ALREADY_STARTED',
      });
    }

    let live = await this.liveDeliveries(inningsId);
    let events = live.map((d) => toScoringEvent(d));

    if (events.some((e) => e.type === DeliveryType.EndInnings)) {
      throw new BadRequestException({
        message: 'This innings has already been ended',
        error: 'INNINGS_ALREADY_ENDED',
      });
    }

    let derived = deriveInnings(events);

    if (!isFirstInnings && !derived.closed) {
      const preview = await this.reader.build(match);
      if (preview.result.decided) {
        await this.audit.record({
          action: 'INNINGS_ENDED',
          actorUserId: user.id,
          targetEntityType: 'innings',
          targetEntityId: inningsId,
          after: { matchId, sequence: innings.sequence, reason: 'TARGET_REACHED' },
        });
        return this.completeMatch(user, matchId);
      }
    }

    if (!derived.closed) {
      const position = currentEventPosition(events);
      const nextSequence = await this.nextSequence(inningsId);
      const endData = await this.buildDeliveryData(matchId, {
        inningsId,
        type: DeliveryType.EndInnings,
        sequence: nextSequence,
        overNumber: position.overNumber,
        ballNumber: position.ballNumber,
        strikerId: null,
        nonStrikerId: null,
        bowlerId: null,
        runsBat: 0,
        extraRuns: 0,
        noBallByeRuns: 0,
        noBallLegByeRuns: 0,
        penaltyBeneficiaryTeamId: null,
        isBoundary: false,
        isFreeHit: false,
        dismissalType: null,
        dismissedId: null,
        fielderId: null,
        fielder2Id: null,
        createdByUserId: user.id,
      });
      await this.prisma.$transaction(async (tx) => {
        await tx.delivery.create({ data: endData });
        return this.bumpVersion(tx, matchId);
      });
      live = await this.liveDeliveries(inningsId);
      events = live.map((d) => toScoringEvent(d));
      derived = deriveInnings(events);
    }

    if (!derived.closed) {
      throw new BadRequestException({
        message: 'This innings cannot be ended yet',
        error: 'INNINGS_NOT_CLOSABLE',
      });
    }

    await this.audit.record({
      action: 'INNINGS_ENDED_MANUALLY',
      actorUserId: user.id,
      targetEntityType: 'innings',
      targetEntityId: inningsId,
      after: { matchId, sequence: innings.sequence, closeReason: derived.closeReason },
    });

    if (isFirstInnings) {
      return this.transitionToChase(user, matchId, match, innings);
    }

    if (innings.inningsType === InningsType.SuperOver) {
      const superRows = allInnings.filter((row) => row.inningsType === InningsType.SuperOver);
      const superIndex = superRows.findIndex((row) => row.id === inningsId);
      if (superIndex >= 0 && superIndex % 2 === 0) {
        return this.transitionToSuperOverChase(user, matchId, match, innings);
      }
      return this.completeMatch(user, matchId);
    }

    return this.completeMatch(user, matchId);
  }

  /** First innings ended — set target and create the chase innings row. */
  private async transitionToChase(
    user: AuthUser,
    matchId: string,
    match: Match,
    innings: Innings,
  ): Promise<ScorecardResponse> {
    const card = await this.reader.build(match);
    const firstRuns = card.innings[0]?.runs ?? 0;
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.match.update({
        where: { id: matchId },
        data: { originalTarget: firstRuns + 1 },
      });
      await tx.innings.create({
        data: {
          matchId,
          sequence: innings.sequence + 1,
          inningsType: InningsType.Normal,
          battingTeamId: innings.bowlingTeamId,
          bowlingTeamId: innings.battingTeamId,
          battingIsExternal: innings.bowlingIsExternal,
          bowlingIsExternal: innings.battingIsExternal,
          oversAllotted: innings.oversAllotted ?? match.oversPerInnings,
        },
      });
      return this.bumpVersion(tx, matchId);
    });
    await this.audit.record({
      action: 'CHASE_INNINGS_STARTED',
      actorUserId: user.id,
      targetEntityType: 'match',
      targetEntityId: matchId,
      after: {
        originalTarget: firstRuns + 1,
        battingTeamId: innings.bowlingTeamId,
        bowlingTeamId: innings.battingTeamId,
      },
    });
    return this.publishAndReturn(updated);
  }

  /** Second (or later normal) innings ended — persist result and complete the match. */
  private async completeMatch(user: AuthUser, matchId: string): Promise<ScorecardResponse> {
    const matchRow = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
      },
    });
    if (!matchRow) {
      throw new NotFoundException({ message: 'Match not found', error: 'MATCH_NOT_FOUND' });
    }

    const card = await this.reader.build(matchRow);
    const result = card.result;

    if (result.superOverRequired) {
      return this.transitionToSuperOverStart(user, matchId, matchRow);
    }

    if (!result.decided) {
      throw new BadRequestException({
        message: 'The match result is not yet decided',
        error: 'RESULT_UNDECIDED',
      });
    }

    const winnerName = this.resolveWinnerDisplayName(matchRow, card);
    const resultNote = formatMatchResultNote(winnerName, result);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.match.update({
        where: { id: matchId },
        data: {
          state: MatchState.Completed,
          completedAt: new Date(),
          winningTeamId: result.winningTeamId,
          resultNote,
        },
      });
      return this.bumpVersion(tx, matchId);
    });
    await this.audit.record({
      action: 'MATCH_COMPLETED',
      actorUserId: user.id,
      targetEntityType: 'match',
      targetEntityId: matchId,
      after: {
        winningTeamId: result.winningTeamId,
        resultNote,
        marginRuns: result.marginRuns,
        marginWickets: result.marginWickets,
      },
    });
    return this.publishAndReturn(updated);
  }

  /** Regulation or super-over tie — begin (or restart) the super-over pair (§14). */
  private async transitionToSuperOverStart(
    user: AuthUser,
    matchId: string,
    match: Match,
  ): Promise<ScorecardResponse> {
    const allInnings = await this.prisma.innings.findMany({
      where: { matchId },
      orderBy: { sequence: 'asc' },
    });
    const normals = allInnings.filter((row) => row.inningsType === InningsType.Normal);
    const superRows = allInnings.filter((row) => row.inningsType === InningsType.SuperOver);
    const mainChaser = normals[1];
    if (!mainChaser) {
      throw new BadRequestException({
        message: 'Super Over requires a completed two-innings match',
        error: 'SUPER_OVER_NOT_APPLICABLE',
      });
    }

    let battingTeamId: string | null;
    let bowlingTeamId: string | null;
    let battingIsExternal: boolean;
    let bowlingIsExternal: boolean;

    if (superRows.length === 0) {
      // First super over: main-match chaser bats first (§14).
      battingTeamId = mainChaser.battingTeamId;
      bowlingTeamId = mainChaser.bowlingTeamId;
      battingIsExternal = mainChaser.battingIsExternal;
      bowlingIsExternal = mainChaser.bowlingIsExternal;
    } else {
      // Repeat super over: team that chased the previous super over bats first (§14).
      const lastSo = superRows[superRows.length - 1]!;
      battingTeamId = lastSo.battingTeamId;
      bowlingTeamId = lastSo.bowlingTeamId;
      battingIsExternal = lastSo.battingIsExternal;
      bowlingIsExternal = lastSo.bowlingIsExternal;
    }

    if (!battingTeamId || !bowlingTeamId) {
      throw new BadRequestException({
        message: 'Super Over teams are not configured',
        error: 'SUPER_OVER_NOT_APPLICABLE',
      });
    }

    const lastSequence = allInnings.at(-1)?.sequence ?? normals.length;
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.innings.create({
        data: {
          matchId,
          sequence: lastSequence + 1,
          inningsType: InningsType.SuperOver,
          battingTeamId,
          bowlingTeamId,
          battingIsExternal,
          bowlingIsExternal,
          oversAllotted: SUPER_OVER_OVERS,
        },
      });
      await tx.match.update({
        where: { id: matchId },
        data: { resultNote: null, winningTeamId: null },
      });
      return this.bumpVersion(tx, matchId);
    });

    await this.audit.record({
      action: 'SUPER_OVER_STARTED',
      actorUserId: user.id,
      targetEntityType: 'match',
      targetEntityId: matchId,
      after: {
        battingTeamId,
        bowlingTeamId,
        oversAllotted: SUPER_OVER_OVERS,
        superOverNumber: Math.floor(superRows.length / 2) + 1,
      },
    });
    return this.publishAndReturn(updated);
  }

  /** First super-over innings complete — create the super-over chase (§14). */
  private async transitionToSuperOverChase(
    user: AuthUser,
    matchId: string,
    match: Match,
    endedInnings: Innings,
  ): Promise<ScorecardResponse> {
    if (!endedInnings.bowlingTeamId || !endedInnings.battingTeamId) {
      throw new BadRequestException({
        message: 'Super Over chase requires configured teams',
        error: 'SUPER_OVER_NOT_APPLICABLE',
      });
    }

    const card = await this.reader.build(match);
    const firstSo = card.innings.find((inn) => inn.inningsId === endedInnings.id);
    const target = (firstSo?.runs ?? 0) + 1;

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.innings.create({
        data: {
          matchId,
          sequence: endedInnings.sequence + 1,
          inningsType: InningsType.SuperOver,
          battingTeamId: endedInnings.bowlingTeamId,
          bowlingTeamId: endedInnings.battingTeamId,
          battingIsExternal: endedInnings.bowlingIsExternal,
          bowlingIsExternal: endedInnings.battingIsExternal,
          oversAllotted: SUPER_OVER_OVERS,
        },
      });
      return this.bumpVersion(tx, matchId);
    });

    await this.audit.record({
      action: 'SUPER_OVER_CHASE_STARTED',
      actorUserId: user.id,
      targetEntityType: 'match',
      targetEntityId: matchId,
      after: {
        target,
        battingTeamId: endedInnings.bowlingTeamId,
        bowlingTeamId: endedInnings.battingTeamId,
      },
    });
    return this.publishAndReturn(updated);
  }

  private resolveWinnerDisplayName(
    match: Match & {
      homeTeam: { id: string; name: string } | null;
      awayTeam: { id: string; name: string } | null;
    },
    card: ScorecardResponse,
  ): string {
    const winnerId = card.result.winningTeamId;
    if (winnerId === match.homeTeamId) {
      return match.homeTeam?.name ?? 'Home';
    }
    if (winnerId === match.awayTeamId) {
      return match.awayTeam?.name ?? 'Away';
    }
    const first = card.innings[0];
    const second = card.innings[1];
    if (
      !winnerId &&
      match.externalOpponentName &&
      first &&
      second &&
      second.runs > first.runs
    ) {
      return match.externalOpponentName;
    }
    if (winnerId === match.homeTeamId || (!winnerId && first && second && first.runs > second.runs)) {
      return match.homeTeam?.name ?? 'Home';
    }
    return match.externalOpponentName ?? match.awayTeam?.name ?? match.homeTeam?.name ?? 'Team';
  }

  /** Persist at-crease batters and/or the current-over bowler before the next delivery. */
  async setInningsParticipants(
    _user: AuthUser,
    matchId: string,
    inningsId: string,
    req: SetInningsParticipantsRequest,
  ): Promise<ScorecardResponse> {
    const match = await this.requireMatch(matchId);
    this.assertVersion(match, req.expectedVersion);
    this.assertScorable(match);

    const innings = await this.requireInnings(matchId, inningsId);
    const { userCol, extCol } = await this.participantColumns(matchId);

    const data: Prisma.InningsUpdateInput = {};
    if (req.strikerId !== undefined) {
      data.selectedStrikerUserId = userCol(req.strikerId);
      data.selectedStrikerExternalId = extCol(req.strikerId);
    }
    if (req.nonStrikerId !== undefined) {
      data.selectedNonStrikerUserId = userCol(req.nonStrikerId);
      data.selectedNonStrikerExternalId = extCol(req.nonStrikerId);
    }
    if (req.bowlerId !== undefined) {
      if (req.bowlerId) {
        const events = (await this.liveDeliveries(inningsId)).map((d) => toScoringEvent(d));
        if (isConsecutiveOverViolation(events, req.bowlerId)) {
          throw new BadRequestException({
            message: 'A bowler cannot bowl two consecutive overs',
            error: 'CONSECUTIVE_OVER',
            fields: { bowlerId: 'Select a different bowler for this over' },
          });
        }
      }
      data.selectedBowlerUserId = userCol(req.bowlerId);
      data.selectedBowlerExternalId = extCol(req.bowlerId);
    }

    this.assertDistinctCreaseSlots(innings, req);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.innings.update({ where: { id: innings.id }, data });
      return this.bumpVersion(tx, matchId);
    });
    return this.publishAndReturn(updated);
  }

  private assertDistinctCreaseSlots(
    innings: Innings,
    req: SetInningsParticipantsRequest,
  ): void {
    const striker =
      req.strikerId !== undefined
        ? req.strikerId
        : (innings.selectedStrikerUserId ?? innings.selectedStrikerExternalId ?? null);
    const nonStriker =
      req.nonStrikerId !== undefined
        ? req.nonStrikerId
        : (innings.selectedNonStrikerUserId ?? innings.selectedNonStrikerExternalId ?? null);
    if (striker && nonStriker && striker === nonStriker) {
      throw new BadRequestException({
        message: 'Striker and non-striker must be different players',
        error: 'DUPLICATE_CREASE_PLAYERS',
      });
    }
  }

  private async participantColumns(
    matchId: string,
  ): Promise<{
    userCol: (id: string | null | undefined) => string | null;
    extCol: (id: string | null | undefined) => string | null;
  }> {
    const externals = await this.prisma.externalPlayer.findMany({ where: { matchId } });
    const externalIds = new Set(externals.map((e) => e.id));
    const isExternal = (id: string | null | undefined): boolean => id != null && externalIds.has(id);
    return {
      userCol: (id) => (id != null && !isExternal(id) ? id : null),
      extCol: (id) => (id != null && isExternal(id) ? id : null),
    };
  }

  private assertCanAppendDelivery(events: ScoringEvent[], req: RecordDeliveryRequest): void {
    if (!inningsAcceptsDelivery(events)) {
      throw new BadRequestException({
        message: 'The innings is closed; no further deliveries may be recorded',
        error: 'INNINGS_CLOSED',
      });
    }

    const isPenalty = req.type === DeliveryType.PenaltyRuns;
    const isCatchDrop = req.type === DeliveryType.CatchDrop;

    if (isCatchDrop) {
      const fielderId = req.fielderId ?? req.dismissal?.fielderId ?? null;
      if (!fielderId) {
        throw new BadRequestException({
          message: 'Select the fielder who dropped the catch',
          error: 'FIELDER_REQUIRED',
        });
      }
    }

    if (isPenalty) {
      if ((req.extraRuns ?? 0) === 0) {
        throw new BadRequestException({
          message: 'Bonus runs adjustment cannot be zero',
          error: 'INVALID_BONUS_RUNS',
        });
      }
    } else if (!isCatchDrop) {
      if ((req.extraRuns ?? 0) < 0) {
        throw new BadRequestException({
          message: 'Extra runs cannot be negative for this delivery type',
          error: 'INVALID_EXTRA_RUNS',
        });
      }

      if (req.type === DeliveryType.Wide && (req.extraRuns ?? 0) < 1) {
        throw new BadRequestException({
          message: 'A wide must include at least the 1-run penalty',
          error: 'INVALID_WIDE_RUNS',
        });
      }

      if (req.type === DeliveryType.NoBall) {
        const penalty = req.extraRuns ?? 0;
        if (penalty < 1) {
          throw new BadRequestException({
            message: 'A no-ball must include at least the 1-run penalty',
            error: 'INVALID_NO_BALL_RUNS',
          });
        }
        const bat = req.runsBat ?? 0;
        const bye = req.noBallByeRuns ?? 0;
        const leg = req.noBallLegByeRuns ?? 0;
        const scoredKinds = [bat > 0, bye > 0, leg > 0].filter(Boolean).length;
        if (scoredKinds > 1) {
          throw new BadRequestException({
            message: 'A no-ball may credit off-bat runs, byes, or leg-byes — not more than one',
            error: 'INVALID_NO_BALL_EXTRAS',
          });
        }
      }

      if (!req.strikerId || !req.nonStrikerId || !req.bowlerId) {
        throw new BadRequestException({
          message: 'Striker, non-striker, and bowler must be set before scoring',
          error: 'PARTICIPANTS_REQUIRED',
        });
      }

      if (isConsecutiveOverViolation(events, req.bowlerId)) {
        throw new BadRequestException({
          message: 'A bowler cannot bowl two consecutive overs',
          error: 'CONSECUTIVE_OVER',
          fields: { bowlerId: 'Select a different bowler for this over' },
        });
      }
    }

    const freeHitNext = deriveInnings(events).freeHitNext;
    const dismissal = req.dismissal?.type ?? null;
    if (freeHitNext && dismissal && !isDismissalAllowedOnFreeHit(dismissal)) {
      throw new BadRequestException({
        message: 'On a free hit, the batter can only be dismissed run out',
        error: 'FREE_HIT_WICKET_NOT_ALLOWED',
      });
    }
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
    const { userCol, extCol } = await this.participantColumns(matchId);

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
      noBallByeRuns: draft.noBallByeRuns,
      noBallLegByeRuns: draft.noBallLegByeRuns,
      penaltyBeneficiaryTeamId: draft.penaltyBeneficiaryTeamId,
      isBoundary: draft.isBoundary,
      isFreeHit: draft.isFreeHit,
      dismissalType: draft.dismissalType,
      dismissedUserId: userCol(draft.dismissedId),
      dismissedExternalId: extCol(draft.dismissedId),
      fielderUserId: userCol(draft.fielderId),
      fielderExternalId: extCol(draft.fielderId),
      fielder2UserId: userCol(draft.fielder2Id),
      fielder2ExternalId: extCol(draft.fielder2Id),
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
