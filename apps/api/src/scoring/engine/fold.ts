import {
  type BatterCard,
  BOWLER_CREDITED_DISMISSALS,
  type BowlerCard,
  type CompletedPartnership,
  DELIVERY_TYPE_LABELS,
  DeliveryType,
  DISMISSAL_TYPE_LABELS,
  DismissalType,
  type DroppedCatchEventView,
  type ExtrasBreakdown,
  type FallOfWicket,
  InningsCloseReason,
  type InningsScorecard,
  InningsType,
  type OverSummary,
  type Partnership,
  type TimelineEntry,
  BALLS_PER_OVER,
  WICKETS_FOR_ALL_OUT,
  WICKETS_FOR_SUPER_OVER_ALL_OUT,
} from '@acc/types';

import type { InningsContext, ScoringEvent } from './types';

/** Delivery types that consume a legal ball (count toward the over) — §32. */
const LEGAL_BALL_TYPES: DeliveryType[] = [
  DeliveryType.Legal,
  DeliveryType.Bye,
  DeliveryType.LegBye,
];

/** Delivery types the striker is deemed to have faced (excludes wides). */
const FACED_TYPES: DeliveryType[] = [...LEGAL_BALL_TYPES, DeliveryType.NoBall];

/** Delivery types that occupy a ball slot in the over (legal + illegal). */
const BALL_TYPES: DeliveryType[] = [...FACED_TYPES, DeliveryType.Wide];

export function isLegalBall(type: DeliveryType): boolean {
  return LEGAL_BALL_TYPES.includes(type);
}

export function occupiesBallSlot(type: DeliveryType): boolean {
  return BALL_TYPES.includes(type);
}

function countsAsFaced(type: DeliveryType): boolean {
  return FACED_TYPES.includes(type);
}

/** Runs charged to the bowler: off-bat + wide/no-ball penalties; byes are not. */
function runsToBowler(e: ScoringEvent): number {
  switch (e.type) {
    case DeliveryType.Legal:
      return e.runsBat;
    case DeliveryType.NoBall:
      return e.extraRuns + e.runsBat;
    case DeliveryType.Wide:
      return e.extraRuns;
    default:
      return 0;
  }
}

function noBallCompletedRuns(e: ScoringEvent): number {
  return e.noBallByeRuns + e.noBallLegByeRuns;
}

/** Runs that cause the batters to physically cross (drives odd-run rotation). */
function runsRunForRotation(e: ScoringEvent): number {
  switch (e.type) {
    case DeliveryType.Legal:
    case DeliveryType.NoBall:
      return e.runsBat + noBallCompletedRuns(e);
    case DeliveryType.Wide:
      // The 1-run wide penalty is not run; any extra are byes run on the wide.
      return Math.max(0, e.extraRuns - 1);
    case DeliveryType.Bye:
    case DeliveryType.LegBye:
      return e.extraRuns;
    default:
      return 0;
  }
}

function penaltyCountsForInnings(e: ScoringEvent, battingTeamId: string | null | undefined): boolean {
  if (e.type !== DeliveryType.PenaltyRuns) {
    return false;
  }
  if (!e.penaltyBeneficiaryTeamId) {
    return true;
  }
  return e.penaltyBeneficiaryTeamId === battingTeamId;
}

function isWicketEvent(e: ScoringEvent): boolean {
  return e.dismissalType !== null || e.type === DeliveryType.RetiredOut;
}

function bowlerCredited(e: ScoringEvent): boolean {
  return e.dismissalType !== null && BOWLER_CREDITED_DISMISSALS.includes(e.dismissalType);
}

function oversText(legalBalls: number): string {
  return `${Math.floor(legalBalls / BALLS_PER_OVER)}.${legalBalls % BALLS_PER_OVER}`;
}

/** Compact code for the overs strip / timeline (spec §28). */
function deliveryCode(e: ScoringEvent): string {
  if (isWicketEvent(e)) return 'W';
  switch (e.type) {
    case DeliveryType.Wide:
      return e.extraRuns > 1 ? `Wd+${e.extraRuns - 1}` : 'Wd';
    case DeliveryType.NoBall:
      if (e.noBallLegByeRuns > 0) {
        return `${e.noBallLegByeRuns}Lb+Nb`;
      }
      if (e.noBallByeRuns > 0) {
        return `${e.noBallByeRuns}B+Nb`;
      }
      return e.runsBat > 0 ? `Nb+${e.runsBat}` : 'Nb';
    case DeliveryType.Bye:
      return `B${e.extraRuns}`;
    case DeliveryType.LegBye:
      return `Lb${e.extraRuns}`;
    case DeliveryType.PenaltyRuns:
      return e.extraRuns >= 0 ? `pen+${e.extraRuns}` : `pen${e.extraRuns}`;
    case DeliveryType.RetiredHurt:
      return 'RH';
    case DeliveryType.RetiredOut:
      return 'W';
    case DeliveryType.ImpactPlayerIn:
      return 'IMP';
    case DeliveryType.Mankad:
      return 'Mk';
    case DeliveryType.EndInnings:
      return 'End';
    case DeliveryType.CatchDrop:
      return 'Drop';
    default:
      return e.runsBat === 0 ? '·' : String(e.runsBat);
  }
}

/** Human-readable description for the ball-by-ball timeline (spec §28). */
function deliveryDescription(e: ScoringEvent): string {
  if (e.dismissalType) {
    return `WICKET — ${DISMISSAL_TYPE_LABELS[e.dismissalType]}`;
  }
  if (e.type === DeliveryType.RetiredOut) return 'WICKET — Retired Out';
  if (e.type === DeliveryType.RetiredHurt) return 'Retired Hurt';
  if (e.type === DeliveryType.EndInnings) return 'Innings ended';
  if (e.type === DeliveryType.CatchDrop) return 'Catch dropped';
  if (e.type === DeliveryType.ImpactPlayerIn) return 'Impact Player In';
  if (e.isBoundary && e.runsBat === 6) return 'SIX';
  if (e.isBoundary && e.runsBat === 4) return 'FOUR';
  if (e.type === DeliveryType.PenaltyRuns) return `${e.extraRuns} penalty run(s)`;
  if (e.type !== DeliveryType.Legal) {
    const total = e.runsBat + e.extraRuns;
    return total > 0 ? `${DELIVERY_TYPE_LABELS[e.type]} +${total}` : DELIVERY_TYPE_LABELS[e.type];
  }
  return `${e.runsBat} run${e.runsBat === 1 ? '' : 's'}`;
}

function round(value: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(value * f) / f;
}

/** Stable chronological ordering: by over, then ball, then append sequence. */
function ordered(events: ScoringEvent[]): ScoringEvent[] {
  return [...events].sort((a, b) => {
    const ao = a.overNumber ?? 0;
    const bo = b.overNumber ?? 0;
    if (ao !== bo) return ao - bo;
    const ab = a.ballNumber ?? 0;
    const bb = b.ballNumber ?? 0;
    if (ab !== bb) return ab - bb;
    return a.sequence - b.sequence;
  });
}

interface MutableBatter {
  playerId: string;
  runs: number;
  balls: number;
  ones: number;
  twos: number;
  threes: number;
  fours: number;
  sixes: number;
  isOut: boolean;
  dismissalType: DismissalType | null;
  bowlerId: string | null;
  fielderId: string | null;
  fielder2Id: string | null;
  retiredHurt: boolean;
  isMankad: boolean;
}

interface MutableBowler {
  playerId: string;
  legalBalls: number;
  runsConceded: number;
  wickets: number;
  maidens: number;
  dotBalls: number;
  wides: number;
  noBalls: number;
  fours: number;
  sixes: number;
}

/**
 * Folds the (already de-voided) event stream into a full innings scorecard.
 * Pure: no I/O, no mutation of inputs. Every number is derived here — nothing
 * is read from a stored counter (spec §12 core design).
 */
export function deriveInnings(events: ScoringEvent[], ctx: InningsContext = {}): InningsScorecard {
  const seq = ordered(events);

  let runs = 0;
  let wickets = 0;
  let legalBalls = 0;

  const extras: ExtrasBreakdown = {
    wides: 0,
    noBalls: 0,
    byes: 0,
    legByes: 0,
    penalties: 0,
    total: 0,
  };

  const batterOrder: string[] = [];
  const batters = new Map<string, MutableBatter>();
  const bowlerOrder: string[] = [];
  const bowlers = new Map<string, MutableBowler>();
  const fallOfWickets: FallOfWicket[] = [];
  const completedPartnerships: CompletedPartnership[] = [];
  const timeline: TimelineEntry[] = [];
  const droppedCatchCounts = new Map<string, number>();
  const droppedCatchEvents: DroppedCatchEventView[] = [];
  let legalBallsAtLastWicket = 0;
  const batterRunsAtLastWicket = new Map<string, number>();
  /** Continuing batter (left/orange) and incoming batter (right/brown) for the active stand. */
  let standLeftBatterId: string | null = null;
  let standRightBatterId: string | null = null;

  const ensureBatter = (id: string | null): MutableBatter | null => {
    if (!id) return null;
    let b = batters.get(id);
    if (!b) {
      b = {
        playerId: id,
        runs: 0,
        balls: 0,
        ones: 0,
        twos: 0,
        threes: 0,
        fours: 0,
        sixes: 0,
        isOut: false,
        dismissalType: null,
        bowlerId: null,
        fielderId: null,
        fielder2Id: null,
        retiredHurt: false,
        isMankad: false,
      };
      batters.set(id, b);
      batterOrder.push(id);
    }
    return b;
  };
  const ensureBowler = (id: string | null): MutableBowler | null => {
    if (!id) return null;
    let b = bowlers.get(id);
    if (!b) {
      b = {
        playerId: id,
        legalBalls: 0,
        runsConceded: 0,
        wickets: 0,
        maidens: 0,
        dotBalls: 0,
        wides: 0,
        noBalls: 0,
        fours: 0,
        sixes: 0,
      };
      bowlers.set(id, b);
      bowlerOrder.push(id);
    }
    return b;
  };

  // Strike state derived for "who is on next ball".
  let striker: string | null = null;
  let nonStriker: string | null = null;
  let currentBowlerId: string | null = null;

  // Per-over maiden accounting (byes/leg-byes don't break a maiden — §32).
  let overBowlerRuns = 0;
  let overLegalBalls = 0;
  let overBowlerId: string | null = null;

  let legalThisOver = 0;
  let pendingFreeHit = false;

  for (const e of seq) {
    // Strike is DERIVED by folding (§12 core design). The recorded ids only
    // seed the opening pair and fill a crease vacated by a wicket/retirement;
    // rotation thereafter comes from the runs + over rules, not the input.
    if (striker === null) striker = e.strikerId;
    if (nonStriker === null) nonStriker = e.nonStrikerId;
    if (e.bowlerId) currentBowlerId = e.bowlerId;

    ensureBatter(striker);
    ensureBatter(nonStriker);

    if (e.type === DeliveryType.CatchDrop && e.fielderId) {
      droppedCatchCounts.set(e.fielderId, (droppedCatchCounts.get(e.fielderId) ?? 0) + 1);
      const batsmanId = e.strikerId ?? striker;
      const batsmanCard = batsmanId ? ensureBatter(batsmanId) : null;
      droppedCatchEvents.push({
        sequence: e.sequence,
        overNumber: e.overNumber,
        ballNumber: e.ballNumber,
        overBallLabel:
          e.overNumber !== null && e.ballNumber !== null ? `${e.overNumber}.${e.ballNumber}` : '',
        batsmanId: batsmanId ?? '',
        batsmanRuns: batsmanCard?.runs ?? 0,
        batsmanBalls: batsmanCard?.balls ?? 0,
        bowlerId: e.bowlerId ?? currentBowlerId,
        fielderId: e.fielderId,
      });
    }

    if (striker && nonStriker && standLeftBatterId === null) {
      standLeftBatterId = striker;
      standRightBatterId = nonStriker;
    } else if (standLeftBatterId && standRightBatterId === null) {
      const fromEvent = [e.strikerId, e.nonStrikerId].find(
        (id): id is string => id != null && id !== standLeftBatterId,
      );
      if (fromEvent) {
        standRightBatterId = fromEvent;
      } else {
        const fromCrease = [striker, nonStriker].find(
          (id): id is string => id !== null && id !== standLeftBatterId,
        );
        if (fromCrease) {
          standRightBatterId = fromCrease;
        }
      }
    }

    if (e.type !== DeliveryType.RetiredHurt) {
      if (striker) {
        const strikerCard = ensureBatter(striker);
        if (strikerCard?.retiredHurt) strikerCard.retiredHurt = false;
      }
      if (nonStriker) {
        const nonStrikerCard = ensureBatter(nonStriker);
        if (nonStrikerCard?.retiredHurt) nonStrikerCard.retiredHurt = false;
      }
    }

    if (e.type === DeliveryType.PenaltyRuns) {
      if (penaltyCountsForInnings(e, ctx.battingTeamId)) {
        runs += e.extraRuns;
      }
    } else {
      runs += e.runsBat + e.extraRuns + noBallCompletedRuns(e);
    }

    switch (e.type) {
      case DeliveryType.Wide:
        extras.wides += e.extraRuns;
        break;
      case DeliveryType.NoBall:
        extras.noBalls += e.extraRuns;
        extras.byes += e.noBallByeRuns;
        extras.legByes += e.noBallLegByeRuns;
        break;
      case DeliveryType.Bye:
        extras.byes += e.extraRuns;
        break;
      case DeliveryType.LegBye:
        extras.legByes += e.extraRuns;
        break;
      case DeliveryType.PenaltyRuns:
        if (penaltyCountsForInnings(e, ctx.battingTeamId)) {
          extras.penalties += e.extraRuns;
        }
        break;
      default:
        break;
    }

    // Batter figures: credit off-bat runs and a faced ball to the striker.
    const strikerCard = ensureBatter(striker);
    if (strikerCard && countsAsFaced(e.type)) {
      strikerCard.balls += 1;
    }
    if (e.type === DeliveryType.Legal || e.type === DeliveryType.NoBall) {
      const runsRecipientId =
        e.dismissalType === DismissalType.RunOut && e.dismissedId && e.dismissedId !== striker
          ? e.dismissedId
          : striker;
      const runsCard = runsRecipientId ? ensureBatter(runsRecipientId) : null;
      if (runsCard) {
        runsCard.runs += e.runsBat;
        if (e.isBoundary && e.runsBat === 4) {
          runsCard.fours += 1;
        } else if (e.isBoundary && e.runsBat === 6) {
          runsCard.sixes += 1;
        } else if (e.runsBat === 1) {
          runsCard.ones += 1;
        } else if (e.runsBat === 2) {
          runsCard.twos += 1;
        } else if (e.runsBat === 3) {
          runsCard.threes += 1;
        }
      }
    }

    // Bowler figures.
    const bowlerCard = ensureBowler(e.bowlerId);
    if (bowlerCard) {
      bowlerCard.runsConceded += runsToBowler(e);
      if (isLegalBall(e.type)) bowlerCard.legalBalls += 1;
      if (bowlerCredited(e)) bowlerCard.wickets += 1;
      if (e.type === DeliveryType.Wide) bowlerCard.wides += 1;
      if (e.type === DeliveryType.NoBall) bowlerCard.noBalls += 1;
      if (occupiesBallSlot(e.type) && e.runsBat + e.extraRuns === 0) {
        bowlerCard.dotBalls += 1;
      }
      if (
        (e.type === DeliveryType.Legal || e.type === DeliveryType.NoBall) &&
        e.isBoundary &&
        e.runsBat === 4
      ) {
        bowlerCard.fours += 1;
      }
      if (
        (e.type === DeliveryType.Legal || e.type === DeliveryType.NoBall) &&
        e.isBoundary &&
        e.runsBat === 6
      ) {
        bowlerCard.sixes += 1;
      }
    }

    // Innings legal-ball count + per-over maiden accumulation.
    if (isLegalBall(e.type)) {
      legalBalls += 1;
      legalThisOver += 1;
      overLegalBalls += 1;
    }
    if (occupiesBallSlot(e.type) && e.bowlerId) {
      overBowlerId = e.bowlerId;
      overBowlerRuns += runsToBowler(e);
    }

    // Wickets + fall-of-wicket.
    if (isWicketEvent(e)) {
      const pairIds: string[] = [striker, nonStriker].filter((id): id is string => id !== null);
      const prevRuns = fallOfWickets.at(-1)?.teamRuns ?? 0;
      const standRuns = runs - prevRuns;
      const standBalls = legalBalls - legalBallsAtLastWicket;
      if (pairIds.length > 0 && (standRuns > 0 || standBalls > 0)) {
        const standBatterIds: string[] = (() => {
          if (
            standLeftBatterId &&
            standRightBatterId &&
            standLeftBatterId !== standRightBatterId
          ) {
            return [standLeftBatterId, standRightBatterId];
          }
          if (standLeftBatterId) {
            const other = pairIds.find((id) => id !== standLeftBatterId);
            if (other) {
              return [standLeftBatterId, other];
            }
          }
          return pairIds;
        })();
        completedPartnerships.push({
          batterIds: standBatterIds,
          batterRuns: standBatterIds.map((id) => ({
            playerId: id,
            runs: (batters.get(id)?.runs ?? 0) - (batterRunsAtLastWicket.get(id) ?? 0),
          })),
          runs: standRuns,
          balls: standBalls,
        });
      }

      wickets += 1;
      const dismissedId: string | null = e.dismissedId ?? striker;
      const card = ensureBatter(dismissedId);
      if (card) {
        card.isOut = true;
        card.dismissalType = e.dismissalType ?? DismissalType.RetiredOut;
        card.bowlerId = bowlerCredited(e) ? e.bowlerId : null;
        card.fielderId = e.fielderId ?? null;
        card.fielder2Id = e.fielder2Id ?? null;
        card.isMankad = e.type === DeliveryType.Mankad;
      }
      fallOfWickets.push({
        wicketNumber: wickets,
        playerId: dismissedId ?? '',
        teamRuns: runs,
        oversText: oversText(legalBalls),
      });
      legalBallsAtLastWicket = legalBalls;
      for (const [id, b] of batters) {
        batterRunsAtLastWicket.set(id, b.runs);
      }
      // Whoever is dismissed leaves; their crease position becomes unknown
      // until the next recorded delivery names the incoming batter.
      if (dismissedId && dismissedId === striker) striker = null;
      else if (dismissedId && dismissedId === nonStriker) nonStriker = null;

      const standSurvivorId: string | null =
        dismissedId && pairIds.length === 2
          ? (pairIds.find((id) => id !== dismissedId) ?? null)
          : (pairIds[0] ?? null);
      standLeftBatterId = standSurvivorId;
      standRightBatterId = null;
    }

    // Retired hurt (not a wicket): leaves the crease but may return (§12.1).
    if (e.type === DeliveryType.RetiredHurt) {
      const retiredId: string | null = e.dismissedId ?? striker;
      const card = ensureBatter(retiredId);
      if (card) {
        card.retiredHurt = true;
      }
      if (retiredId && retiredId === striker) striker = null;
      else if (retiredId && retiredId === nonStriker) nonStriker = null;
    }

    // Strike rotation: odd runs swap, boundaries never swap (§32).
    if (occupiesBallSlot(e.type)) {
      const runsRun = runsRunForRotation(e);
      if (!e.isBoundary && runsRun % 2 === 1) {
        [striker, nonStriker] = [nonStriker, striker];
      }
    }

    // End-of-over: rotate strike and (if applicable) credit a maiden — §32.
    if (isLegalBall(e.type) && legalThisOver === BALLS_PER_OVER) {
      if (overLegalBalls === BALLS_PER_OVER && overBowlerRuns === 0 && overBowlerId) {
        const ob = ensureBowler(overBowlerId);
        if (ob) ob.maidens += 1;
      }
      [striker, nonStriker] = [nonStriker, striker];
      legalThisOver = 0;
      overLegalBalls = 0;
      overBowlerRuns = 0;
      overBowlerId = null;
    }

    timeline.push({
      sequence: e.sequence,
      overNumber: e.overNumber,
      ballNumber: e.ballNumber,
      label: e.overNumber !== null && e.ballNumber !== null ? `${e.overNumber}.${e.ballNumber}` : '',
      code: deliveryCode(e),
      runs:
        e.type === DeliveryType.PenaltyRuns && !penaltyCountsForInnings(e, ctx.battingTeamId)
          ? 0
          : e.type === DeliveryType.PenaltyRuns
            ? e.extraRuns
            : e.runsBat + e.extraRuns + noBallCompletedRuns(e),
      isWicket: isWicketEvent(e),
      isBoundary: e.isBoundary,
      description: deliveryDescription(e),
    });

    // Free hit bookkeeping for the next delivery (§12.1).
    if (e.type === DeliveryType.NoBall) {
      pendingFreeHit = true;
    } else if (isLegalBall(e.type)) {
      pendingFreeHit = false;
    }
    // A wide leaves the free hit pending (the ball is re-bowled).
  }

  extras.total = extras.wides + extras.noBalls + extras.byes + extras.legByes + extras.penalties;

  const batterCards: BatterCard[] = batterOrder.map((id) => {
    const b = batters.get(id) as MutableBatter;
    return {
      playerId: b.playerId,
      runs: b.runs,
      balls: b.balls,
      ones: b.ones,
      twos: b.twos,
      threes: b.threes,
      fours: b.fours,
      sixes: b.sixes,
      strikeRate: b.balls > 0 ? round((b.runs / b.balls) * 100, 2) : 0,
      isOut: b.isOut,
      dismissalType: b.dismissalType,
      bowlerId: b.bowlerId,
      fielderId: b.fielderId,
      fielder2Id: b.fielder2Id,
      retiredHurt: b.retiredHurt,
      isMankad: b.isMankad,
    };
  });

  const bowlerCards: BowlerCard[] = bowlerOrder.map((id) => {
    const b = bowlers.get(id) as MutableBowler;
    const oversBowled = b.legalBalls / BALLS_PER_OVER;
    return {
      playerId: b.playerId,
      legalBalls: b.legalBalls,
      oversText: oversText(b.legalBalls),
      runsConceded: b.runsConceded,
      wickets: b.wickets,
      maidens: b.maidens,
      dotBalls: b.dotBalls,
      wides: b.wides,
      noBalls: b.noBalls,
      fours: b.fours,
      sixes: b.sixes,
      economy: oversBowled > 0 ? round(b.runsConceded / oversBowled, 2) : 0,
    };
  });

  // Innings-end conditions (§32).
  const target = ctx.target ?? null;
  const oversAllotted = ctx.oversAllotted ?? null;
  runs = Math.max(0, runs);
  const wicketCap =
    ctx.inningsType === InningsType.SuperOver
      ? WICKETS_FOR_SUPER_OVER_ALL_OUT
      : WICKETS_FOR_ALL_OUT;
  const allOut = wickets >= wicketCap;
  const oversDone = oversAllotted !== null && legalBalls >= oversAllotted * BALLS_PER_OVER;
  const targetReached = target !== null && runs >= target;
  const manuallyEnded = seq.some((e) => e.type === DeliveryType.EndInnings);

  let closeReason: InningsCloseReason | null = null;
  if (targetReached) closeReason = InningsCloseReason.TargetReached;
  else if (allOut) closeReason = InningsCloseReason.AllOut;
  else if (oversDone) closeReason = InningsCloseReason.OversComplete;
  else if (manuallyEnded) closeReason = InningsCloseReason.ManuallyEnded;

  // Recent-overs strip: group ball-occupying timeline entries by over (§28).
  const overMap = new Map<number, OverSummary>();
  for (const t of timeline) {
    if (t.overNumber === null) continue;
    let over = overMap.get(t.overNumber);
    if (!over) {
      over = { overNumber: t.overNumber, balls: [], runs: 0, wickets: 0 };
      overMap.set(t.overNumber, over);
    }
    over.balls.push(t.code);
    over.runs += t.runs;
    if (t.isWicket) over.wickets += 1;
  }
  const RECENT_OVERS = 6;
  const recentOvers: OverSummary[] = [...overMap.values()]
    .sort((a, b) => a.overNumber - b.overNumber)
    .slice(-RECENT_OVERS);

  const participants = resolveLiveParticipants(
    { striker, nonStriker, currentBowlerId, legalBalls },
    ctx,
  );

  // Current partnership: runs/balls since the last wicket between the pair (§28).
  const lastWicketRuns = fallOfWickets.at(-1)?.teamRuns ?? 0;
  const partnershipIds =
    standLeftBatterId && standRightBatterId
      ? [standLeftBatterId, standRightBatterId]
      : [participants.currentStrikerId, participants.currentNonStrikerId].filter(
          (id): id is string => id !== null,
        );
  const partnership: Partnership | null =
    legalBalls === 0 && timeline.length === 0
      ? null
      : {
          runs: runs - lastWicketRuns,
          balls: legalBalls - legalBallsAtLastWicket,
          batterIds: partnershipIds,
          batterRuns: partnershipIds.map((id) => ({
            playerId: id,
            runs: (batters.get(id)?.runs ?? 0) - (batterRunsAtLastWicket.get(id) ?? 0),
          })),
        };

  return {
    inningsId: ctx.inningsId ?? null,
    sequence: ctx.sequence ?? 0,
    inningsType: ctx.inningsType ?? InningsType.Normal,
    battingTeamId: ctx.battingTeamId ?? null,
    bowlingTeamId: ctx.bowlingTeamId ?? null,
    runs,
    wickets,
    legalBalls,
    oversText: oversText(legalBalls),
    oversAllotted,
    extras,
    batters: batterCards,
    bowlers: bowlerCards,
    fallOfWickets,
    recentOvers,
    timeline,
    partnership,
    partnerships: completedPartnerships,
    ...participants,
    freeHitNext: pendingFreeHit,
    closed: closeReason !== null,
    closeReason,
    target,
    droppedCatches: [...droppedCatchCounts.entries()].map(([playerId, count]) => ({
      playerId,
      count,
    })),
    droppedCatchEvents,
    battingIsExternal: ctx.battingIsExternal ?? false,
    bowlingIsExternal: ctx.bowlingIsExternal ?? false,
  };
}

/** Merge folded crease state with scorer selections persisted on the innings row. */
export function resolveLiveParticipants(
  folded: {
    striker: string | null;
    nonStriker: string | null;
    currentBowlerId: string | null;
    legalBalls: number;
  },
  ctx: InningsContext,
): {
  currentStrikerId: string | null;
  currentNonStrikerId: string | null;
  currentBowlerId: string | null;
} {
  let striker = folded.striker;
  let nonStriker = folded.nonStriker;
  let bowler = folded.currentBowlerId;

  if (striker === null && ctx.selectedStrikerId != null) {
    striker = ctx.selectedStrikerId;
  }
  if (nonStriker === null && ctx.selectedNonStrikerId != null) {
    nonStriker = ctx.selectedNonStrikerId;
  }

  const atOverBoundary =
    folded.legalBalls > 0 && folded.legalBalls % BALLS_PER_OVER === 0;

  if (folded.legalBalls === 0 || atOverBoundary) {
    bowler = ctx.selectedBowlerId ?? null;
  } else if (bowler === null && ctx.selectedBowlerId != null) {
    bowler = ctx.selectedBowlerId;
  }

  return {
    currentStrikerId: striker,
    currentNonStrikerId: nonStriker,
    currentBowlerId: bowler,
  };
}
