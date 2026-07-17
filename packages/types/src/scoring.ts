/**
 * Scoring engine contracts (spec §12, §14, §32) shared between the api and
 * mobile. The engine itself is an append-only event log: a {@link DeliveryType}
 * event is appended to an innings and all totals/figures are DERIVED by folding
 * over the event stream — never stored as mutable counters.
 */

import type { BallType } from './rbac';

/** Type of a scoring event (spec §12.1). */
export const DeliveryType = {
  Legal: 'LEGAL',
  Wide: 'WIDE',
  NoBall: 'NO_BALL',
  Bye: 'BYE',
  LegBye: 'LEG_BYE',
  /** Discrete penalty runs awarded to the batting team (§12.1). */
  PenaltyRuns: 'PENALTY_RUNS',
  /** Player retires but MAY return to bat this innings — not a wicket (§12.1). */
  RetiredHurt: 'RETIRED_HURT',
  /** Player retires and cannot return — counts as a wicket (§12.1). */
  RetiredOut: 'RETIRED_OUT',
  /** Impact Player brought in (§8) — recorded as a discrete event. */
  ImpactPlayerIn: 'IMPACT_PLAYER_IN',
  /** Pre-delivery non-striker run out by the bowler (UI: Mankad; scored as RUN_OUT — §30.3). */
  Mankad: 'MANKAD',
  /** Scorer manually ends the innings (declaration / rain / agreement — §12.2). */
  EndInnings: 'END_INNINGS',
  /** Fielder dropped a catch — metadata only; no runs, wicket, or ball progression (§12.1). */
  CatchDrop: 'CATCH_DROP',
} as const;
export type DeliveryType = (typeof DeliveryType)[keyof typeof DeliveryType];

export const DELIVERY_TYPE_LABELS: Record<DeliveryType, string> = {
  LEGAL: 'Legal',
  WIDE: 'Wide',
  NO_BALL: 'No Ball',
  BYE: 'Bye',
  LEG_BYE: 'Leg Bye',
  PENALTY_RUNS: 'Penalty Runs',
  RETIRED_HURT: 'Retired Hurt',
  RETIRED_OUT: 'Retired Out',
  IMPACT_PLAYER_IN: 'Impact Player In',
  MANKAD: 'Mankad',
  END_INNINGS: 'End Innings',
  CATCH_DROP: 'Catch Drop',
};

/**
 * Dismissal modes in scope (spec §12.1). Out-of-scope modes (mankad,
 * obstructing the field, timed out, handled the ball — §30.3) are deliberately
 * absent and must never be added here.
 */
export const DismissalType = {
  Bowled: 'BOWLED',
  Caught: 'CAUGHT',
  Lbw: 'LBW',
  RunOut: 'RUN_OUT',
  Stumped: 'STUMPED',
  HitWicket: 'HIT_WICKET',
  RetiredOut: 'RETIRED_OUT',
} as const;
export type DismissalType = (typeof DismissalType)[keyof typeof DismissalType];

export const DISMISSAL_TYPE_LABELS: Record<DismissalType, string> = {
  BOWLED: 'Bowled',
  CAUGHT: 'Caught',
  LBW: 'LBW',
  RUN_OUT: 'Run Out',
  STUMPED: 'Stumped',
  HIT_WICKET: 'Hit Wicket',
  RETIRED_OUT: 'Retired Out',
};

/** Dismissals credited to the bowler (§32 bowling figures). */
export const BOWLER_CREDITED_DISMISSALS: DismissalType[] = [
  DismissalType.Bowled,
  DismissalType.Caught,
  DismissalType.Lbw,
  DismissalType.Stumped,
  DismissalType.HitWicket,
];

/** Why an innings is closed (spec §32 innings-end conditions). */
export const InningsCloseReason = {
  AllOut: 'ALL_OUT',
  OversComplete: 'OVERS_COMPLETE',
  TargetReached: 'TARGET_REACHED',
  ManuallyEnded: 'MANUALLY_ENDED',
} as const;
export type InningsCloseReason =
  (typeof InningsCloseReason)[keyof typeof InningsCloseReason];

export const InningsType = {
  Normal: 'NORMAL',
  SuperOver: 'SUPER_OVER',
} as const;
export type InningsType = (typeof InningsType)[keyof typeof InningsType];

// --- Constants (spec §32, §14) ---------------------------------------------

export const BALLS_PER_OVER = 6;
export const WICKETS_FOR_ALL_OUT = 10;
/** Two dismissals end a super-over innings (§14). */
export const WICKETS_FOR_SUPER_OVER_ALL_OUT = 2;
export const PLAYERS_PER_TEAM = 11;
export const SUPER_OVER_OVERS = 1;
export const POINTS_WIN = 2;
export const POINTS_TIE_OR_NO_RESULT = 1;
export const POINTS_LOSS = 0;

/** Standard on-field penalty awarded via More → Penalty (§12.1). */
export const STANDARD_MATCH_PENALTY_RUNS = 5;

/** §12.3: the exact error returned when a stale scorecard save is rejected. */
export const STALE_SCORECARD_ERROR = 'Scorecard got updated.';

// --- Requests --------------------------------------------------------------

/** Open a new innings (the normal innings, or a chained Super Over — §14). */
export interface StartInningsRequest {
  inningsType?: InningsType;
  battingTeamId?: string | null;
  bowlingTeamId?: string | null;
  battingIsExternal?: boolean;
  bowlingIsExternal?: boolean;
  oversAllotted?: number | null;
  expectedVersion: number;
}

export interface DismissalInput {
  type: DismissalType;
  /** Defaults to the striker when omitted (e.g. run-out can name either batter). */
  dismissedId?: string | null;
  fielderId?: string | null;
  /** Run-out relay — second fielder (notation "run out (f1/f2)"). */
  fielder2Id?: string | null;
}

/**
 * Record one scoring event. The engine assigns the over/ball position; the
 * client supplies who is on strike. `expectedVersion` guards against a
 * concurrent writer (§12.3).
 */
export interface RecordDeliveryRequest {
  type: DeliveryType;
  strikerId?: string | null;
  nonStrikerId?: string | null;
  bowlerId?: string | null;
  /** Runs off the bat, INCLUDING overthrows on the same delivery (§12.1). */
  runsBat?: number;
  /** Extra runs credited to the batting team (wide/no-ball penalty, byes…). */
  extraRuns?: number;
  /**
   * On a no-ball: completed runs taken as byes (not off the bat). The 1-run
   * no-ball penalty remains in {@link extraRuns}. Mutually exclusive with
   * {@link runsBat} and {@link noBallLegByeRuns}.
   */
  noBallByeRuns?: number;
  /**
   * On a no-ball: completed runs taken as leg-byes (not off the bat). The 1-run
   * no-ball penalty remains in {@link extraRuns}. Mutually exclusive with
   * {@link runsBat} and {@link noBallByeRuns}.
   */
  noBallLegByeRuns?: number;
  /** True for a 4/6 off the bat — boundaries never rotate strike (§32). */
  isBoundary?: boolean;
  dismissal?: DismissalInput | null;
  /**
   * Metadata events (e.g. CATCH_DROP): the fielding-side player who dropped the catch.
   */
  fielderId?: string | null;
  /**
   * Penalty-runs only: which team receives the runs (defaults to the batting side
   * of the innings in which the event is recorded).
   */
  penaltyBeneficiaryTeamId?: string | null;
  expectedVersion: number;
}

/** Edit an existing ball within the scorer edit window (§12.2). */
export interface EditDeliveryRequest extends RecordDeliveryRequest {
  deliveryId: string;
}

/** Scorer enters the umpire-calculated DLS target (§12.1). */
export interface SetDlsTargetRequest {
  originalTarget?: number | null;
  dlsTarget: number;
  expectedVersion: number;
}

/** Revise overs allotted after a rain interruption (§12.2). */
export interface UpdateOversAllottedRequest {
  inningsId: string;
  oversAllotted: number;
  expectedVersion: number;
}

/** Persist at-crease batters and/or the current-over bowler before the next delivery. */
export interface SetInningsParticipantsRequest {
  strikerId?: string | null;
  nonStrikerId?: string | null;
  bowlerId?: string | null;
  expectedVersion: number;
}

/** Reverse the most recently appended delivery (re-derive all state). */
export interface UndoDeliveryRequest {
  expectedVersion: number;
}

/** Manually end the current innings and run the innings-transition flow (§12.2). */
export interface EndInningsRequest {
  expectedVersion: number;
}

// --- Derived read models ----------------------------------------------------

export interface BatterCard {
  playerId: string;
  runs: number;
  balls: number;
  /** Off-bat singles (non-boundary). */
  ones: number;
  /** Off-bat twos (non-boundary). */
  twos: number;
  /** Off-bat threes (non-boundary). */
  threes: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  isOut: boolean;
  dismissalType: DismissalType | null;
  bowlerId: string | null;
  fielderId: string | null;
  /** Run-out relay — second fielder. */
  fielder2Id: string | null;
  /** Off crease but not out — may resume batting later (§12.1). */
  retiredHurt: boolean;
  /** Run out via a pre-delivery Mankad (notation suffix). */
  isMankad: boolean;
}

/** Live / scorecard batter row — SR from engine figures (2 dp); 0.00 when no balls faced. */
export function formatBatterStrikeRateDisplay(
  card: Pick<BatterCard, 'strikeRate' | 'balls'> | undefined,
): string {
  if (!card || card.balls <= 0) {
    return '0.00';
  }
  return card.strikeRate.toFixed(2);
}

export interface BowlerCard {
  playerId: string;
  legalBalls: number;
  oversText: string;
  runsConceded: number;
  wickets: number;
  maidens: number;
  dotBalls: number;
  wides: number;
  noBalls: number;
  fours: number;
  sixes: number;
  economy: number;
}

/** Live / scorecard bowling row — economy from engine figures (2 dp); 0.00 when no legal balls. */
export function formatBowlerEconomyDisplay(
  card: Pick<BowlerCard, 'economy' | 'legalBalls'> | undefined,
): string {
  if (!card || card.legalBalls <= 0) {
    return '0.00';
  }
  return card.economy.toFixed(2);
}

export interface FallOfWicket {
  wicketNumber: number;
  playerId: string;
  teamRuns: number;
  oversText: string;
}

export interface ExtrasBreakdown {
  wides: number;
  noBalls: number;
  byes: number;
  legByes: number;
  penalties: number;
  total: number;
}

/** One delivery rendered for the ball-by-ball timeline (spec §28). */
export interface TimelineEntry {
  sequence: number;
  overNumber: number | null;
  ballNumber: number | null;
  /** Position label, e.g. "12.3"; empty for non-ball events. */
  label: string;
  /** Compact code shown in the overs strip: "·", "1", "4", "6", "W", "Wd", "Nb", "B", "Lb". */
  code: string;
  /** Total team runs from this event. */
  runs: number;
  isWicket: boolean;
  isBoundary: boolean;
  /** Human description, e.g. "FOUR", "WICKET — bowled". */
  description: string;
}

/** A completed/partial over for the recent-overs strip (spec §28). */
export interface OverSummary {
  overNumber: number;
  balls: string[];
  runs: number;
  wickets: number;
}

/** Current unbroken partnership between the two not-out batters (spec §28). */
export interface Partnership {
  runs: number;
  balls: number;
  batterIds: string[];
  /** Runs each batter has scored since this stand began (off-bat only). */
  batterRuns: { playerId: string; runs: number }[];
}

/** A completed batting stand (closed at a wicket). Extras count toward stand runs (§28). */
export interface CompletedPartnership {
  batterIds: string[];
  /** Each batter's individual score when the stand ended. */
  batterRuns: { playerId: string; runs: number }[];
  runs: number;
  balls: number;
}

export interface InningsScorecard {
  inningsId: string | null;
  sequence: number;
  inningsType: InningsType;
  battingTeamId: string | null;
  bowlingTeamId: string | null;
  runs: number;
  wickets: number;
  legalBalls: number;
  oversText: string;
  oversAllotted: number | null;
  extras: ExtrasBreakdown;
  batters: BatterCard[];
  bowlers: BowlerCard[];
  fallOfWickets: FallOfWicket[];
  /** Recent overs strip, most-recent over last (spec §28). */
  recentOvers: OverSummary[];
  /** Full ball-by-ball timeline in chronological order (spec §28). */
  timeline: TimelineEntry[];
  /** Current unbroken partnership, or null before the first ball (spec §28). */
  partnership: Partnership | null;
  /** Wicket-to-wicket stands closed before the current partnership (§28). */
  partnerships: CompletedPartnership[];
  currentStrikerId: string | null;
  currentNonStrikerId: string | null;
  currentBowlerId: string | null;
  /** §12.1: the next legal delivery is a free hit (after any no-ball). */
  freeHitNext: boolean;
  closed: boolean;
  closeReason: InningsCloseReason | null;
  target: number | null;
  /** Per-fielder dropped-catch counts from CATCH_DROP metadata events. */
  droppedCatches: { playerId: string; count: number }[];
  /** Chronological CATCH_DROP metadata events with batter figures at the moment of the drop. */
  droppedCatchEvents: DroppedCatchEventView[];
  /** True when the batting side is an external (name-only) opponent — §9.5. */
  battingIsExternal?: boolean;
  /** True when the bowling side is an external (name-only) opponent — §9.5. */
  bowlingIsExternal?: boolean;
}

/** One dropped-catch metadata event for leader-only live scoring display. */
export interface DroppedCatchEventView {
  sequence: number;
  overNumber: number | null;
  ballNumber: number | null;
  /** Position label, e.g. "12.3". */
  overBallLabel: string;
  /** On-strike batter when the drop was recorded. */
  batsmanId: string;
  /** Batter cumulative runs immediately before/at the drop event. */
  batsmanRuns: number;
  /** Batter balls faced immediately before/at the drop event. */
  batsmanBalls: number;
  bowlerId: string | null;
  fielderId: string;
}

export interface MatchResultView {
  decided: boolean;
  isTie: boolean;
  isNoResult: boolean;
  winningTeamId: string | null;
  /** Runs margin when the team that batted first wins (§32). */
  marginRuns: number | null;
  /** Wickets remaining when the chasing side wins (§32). */
  marginWickets: number | null;
  /** True when a (further) Super Over is required to break a tie (§14). */
  superOverRequired: boolean;
  note: string | null;
}

/** Per-innings batting/bowling team labels for scorecard display (§28). */
export interface ScorecardInningsLabels {
  inningsId: string | null;
  battingTeamId: string | null;
  battingTeamName: string;
  battingTeamLogoUrl: string | null;
  bowlingTeamId: string | null;
  bowlingTeamName: string;
}

/** Resolved participant and team names bundled with the scorecard (guest-readable). */
export interface ScorecardDisplayContext {
  /** Opaque participant id (registered userId or external player id) → display name. */
  players: Record<string, string>;
  innings: ScorecardInningsLabels[];
}

export interface ScorecardResponse {
  matchId: string;
  version: number;
  originalTarget: number | null;
  dlsTarget: number | null;
  /** The target actually in effect (DLS overrides original — §12.1). */
  effectiveTarget: number | null;
  innings: InningsScorecard[];
  result: MatchResultView;
  /** Resolved team and player display names — always present on API responses. */
  display: ScorecardDisplayContext;
}

/** Which crease slot the scorer is filling on the Select Batsman screen. */
export const BatsmanPickerRole = {
  Striker: 'STRIKER',
  NonStriker: 'NON_STRIKER',
  /** Incoming batter after a wicket (or when one crease slot is empty mid-innings). */
  Incoming: 'INCOMING',
} as const;
export type BatsmanPickerRole = (typeof BatsmanPickerRole)[keyof typeof BatsmanPickerRole];

/** Live batting status for a Playing 11 row in the picker. */
export const BatsmanPickerStatus = {
  AtCrease: 'AT_CREASE',
  Out: 'OUT',
  YetToBat: 'YET_TO_BAT',
  /** Retired hurt — off crease, score preserved, may return. */
  RetiredHurt: 'RETIRED_HURT',
} as const;
export type BatsmanPickerStatus = (typeof BatsmanPickerStatus)[keyof typeof BatsmanPickerStatus];

export const BATSMAN_PICKER_STATUS_LABELS: Record<BatsmanPickerStatus, string> = {
  AT_CREASE: 'At crease',
  OUT: 'Out',
  YET_TO_BAT: 'Yet to bat',
  RETIRED_HURT: 'Retired hurt — can return',
};

export interface BatsmanPickerPlayerRow {
  /** Registered user id or external player id (opaque participant id). */
  userId: string;
  firstName: string;
  lastName: string;
  profilePhotoUrl: string | null;
  battingStyle: string | null;
  /** True for live-added external opponent batters (§9.5). */
  isExternal: boolean;
  status: BatsmanPickerStatus;
  runs: number | null;
  balls: number | null;
  /** Scorecard-style dismissal (e.g. "c Butler b Wood"); null when not out. */
  dismissalText: string | null;
  selectable: boolean;
  /** Filled orange check — at crease or chosen for the active slot. */
  selected: boolean;
}

/** Named substitute from the locked matchday squad (§9.7). */
export interface BatsmanPickerSubstituteRow {
  userId: string;
  firstName: string;
  lastName: string;
  profilePhotoUrl: string | null;
  battingStyle: string | null;
}

/** State-aware Select Batsman picker payload (derived innings + squad profiles). */
export interface BatsmanPickerResponse {
  matchId: string;
  inningsId: string;
  /** Null when the batting side is the ACC external opponent (§9.5). */
  battingTeamId: string | null;
  battingTeamName: string;
  /** True when the batting side is the unregistered external opponent. */
  battingSideIsExternal: boolean;
  role: BatsmanPickerRole;
  /** Opaque participant ids — registered `userId` or external player id. */
  players: BatsmanPickerPlayerRow[];
  /** Registered teams only — substitutes already included in `players`; always empty for external sides. */
  availableSubstitutes: BatsmanPickerSubstituteRow[];
}

type DismissalNameResolver = (playerId: string | null) => string;

/** Builds short scorecard dismissal text (e.g. "c Butler b Wood"). */
export function formatDismissalShort(
  card: Pick<BatterCard, 'dismissalType' | 'bowlerId' | 'fielderId'> & {
    fielder2Id?: string | null;
    isMankad?: boolean;
  },
  nameOf: DismissalNameResolver,
): string {
  if (!card.dismissalType) return '';
  const bowler = card.bowlerId ? nameOf(card.bowlerId) : null;
  const fielder = card.fielderId ? nameOf(card.fielderId) : null;
  const fielder2 = card.fielder2Id ? nameOf(card.fielder2Id) : null;
  switch (card.dismissalType) {
    case DismissalType.Bowled:
      return bowler ? `b ${bowler}` : DISMISSAL_TYPE_LABELS.BOWLED;
    case DismissalType.Caught:
      if (card.fielderId && card.bowlerId && card.fielderId === card.bowlerId && bowler) {
        return `c & b ${bowler}`;
      }
      return fielder && bowler ? `c ${fielder} b ${bowler}` : fielder ? `c ${fielder}` : DISMISSAL_TYPE_LABELS.CAUGHT;
    case DismissalType.Lbw:
      return bowler ? `lbw b ${bowler}` : DISMISSAL_TYPE_LABELS.LBW;
    case DismissalType.RunOut:
      if (fielder && fielder2) {
        return `run out (${fielder}/${fielder2})`;
      }
      if (fielder && card.isMankad) {
        return `run out (${fielder}) (mankad)`;
      }
      return fielder ? `run out (${fielder})` : DISMISSAL_TYPE_LABELS.RUN_OUT;
    case DismissalType.Stumped:
      return fielder && bowler ? `st ${fielder} b ${bowler}` : DISMISSAL_TYPE_LABELS.STUMPED;
    case DismissalType.HitWicket:
      return bowler ? `hit wicket b ${bowler}` : DISMISSAL_TYPE_LABELS.HIT_WICKET;
    case DismissalType.RetiredOut:
      return DISMISSAL_TYPE_LABELS.RETIRED_OUT;
    default:
      return DISMISSAL_TYPE_LABELS[card.dismissalType];
  }
}

/** Batting status for the scorecard table — dismissal text or "not out". */
export function formatBatterStatus(
  card: BatterCard,
  nameOf: DismissalNameResolver,
): string {
  if (card.retiredHurt && !card.isOut) {
    return 'retired hurt';
  }
  if (!card.isOut) {
    return 'not out';
  }
  return formatDismissalShort(card, nameOf);
}

/** Compact batter line for the score header, e.g. "88*(92)" or "42(35)". */
export function formatBatterHeaderFigures(
  card: BatterCard,
  onStrike: boolean,
): string {
  const runs = onStrike && !card.isOut ? `${card.runs}*` : String(card.runs);
  return `${runs} (${card.balls})`;
}

/** Non-zero extra types for scorecard rows, e.g. ["w 8", "b 4"]. */
export function extrasBreakdownParts(extras: ExtrasBreakdown): string[] {
  const parts: string[] = [];
  if (extras.wides > 0) parts.push(`w ${extras.wides}`);
  if (extras.byes > 0) parts.push(`b ${extras.byes}`);
  if (extras.legByes > 0) parts.push(`lb ${extras.legByes}`);
  if (extras.noBalls > 0) parts.push(`nb ${extras.noBalls}`);
  if (extras.penalties > 0) parts.push(`p ${extras.penalties}`);
  return parts;
}

/** Extras row label, e.g. "Extras (w 8, b 4, lb 2) = 14". */
export function formatExtrasBreakdown(extras: ExtrasBreakdown): string {
  const parts = extrasBreakdownParts(extras);
  const breakdown = parts.length > 0 ? ` (${parts.join(', ')})` : '';
  return `Extras${breakdown} = ${extras.total}`;
}

/** Group timeline entries by over for ball-by-ball display (all overs, oldest first). */
export function groupTimelineByOver(timeline: TimelineEntry[]): OverSummary[] {
  const overMap = new Map<number, OverSummary>();
  for (const entry of timeline) {
    if (entry.overNumber === null) {
      continue;
    }
    let over = overMap.get(entry.overNumber);
    if (!over) {
      over = { overNumber: entry.overNumber, balls: [], runs: 0, wickets: 0 };
      overMap.set(entry.overNumber, over);
    }
    over.balls.push(entry.code);
    over.runs += entry.runs;
    if (entry.isWicket) {
      over.wickets += 1;
    }
  }
  return [...overMap.values()].sort((a, b) => a.overNumber - b.overNumber);
}

/** Compact fall-of-wickets line — e.g. "3-45 (Saurabh Patel, 6.2)". */
export function formatFallOfWicketCompact(
  fow: FallOfWicket,
  nameOf: DismissalNameResolver,
): string {
  return `${fow.wicketNumber}-${fow.teamRuns} (${nameOf(fow.playerId)}, ${fow.oversText})`;
}

/** Partnership run rate (runs per over) from balls faced. */
export function partnershipRunRate(runs: number, balls: number): number {
  if (balls <= 0) {
    return 0;
  }
  return Math.round((runs / (balls / BALLS_PER_OVER)) * 10) / 10;
}

export function wicketOrdinal(n: number): string {
  const suffixes = ['TH', 'ST', 'ND', 'RD'] as const;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${n}TH`;
  }
  const mod10 = n % 10;
  const suffix = mod10 === 1 ? suffixes[1] : mod10 === 2 ? suffixes[2] : mod10 === 3 ? suffixes[3] : suffixes[0];
  return `${n}${suffix}`;
}

/** Line 1 — e.g. "1ST WICKET: 1-118" (wicket number, hyphen, team score at fall). */
export function formatFallOfWicketHeadline(fow: FallOfWicket): string {
  return `${wicketOrdinal(fow.wicketNumber)} WICKET: ${fow.wicketNumber}-${fow.teamRuns}`;
}

/** Line 2 — e.g. "R. Sharma, 16.4 ov". */
export function formatFallOfWicketDetail(
  fow: FallOfWicket,
  nameOf: DismissalNameResolver,
): string {
  return `${nameOf(fow.playerId)}, ${fow.oversText} ov`;
}

/** Single-line fall-of-wickets entry (compact views). */
export function formatFallOfWicketEntry(
  fow: FallOfWicket,
  nameOf: DismissalNameResolver,
): string {
  return `${formatFallOfWicketHeadline(fow)} ${formatFallOfWicketDetail(fow, nameOf)}`;
}

/** Why a bowler cannot be selected for the current over. */
export const BowlerPickerIneligibility = {
  ConsecutiveOver: 'CONSECUTIVE_OVER',
  QuotaReached: 'QUOTA_REACHED',
} as const;
export type BowlerPickerIneligibility =
  (typeof BowlerPickerIneligibility)[keyof typeof BowlerPickerIneligibility];

export interface BowlerPickerPlayerRow {
  /** Registered user id or external player id (opaque participant id). */
  userId: string;
  firstName: string;
  lastName: string;
  profilePhotoUrl: string | null;
  bowlingType: string | null;
  bowlingTypeLabel: string;
  /** Standard O-M-R-W notation when the bowler has delivered this innings; null otherwise. */
  figuresOmRw: string | null;
  isExternal: boolean;
  selectable: boolean;
  selected: boolean;
  ineligibility: BowlerPickerIneligibility | null;
  ineligibilityHint: string | null;
}

/** State-aware Select Bowler picker payload (derived innings + squad profiles). */
export interface BowlerPickerResponse {
  matchId: string;
  inningsId: string;
  /** Null when the bowling side is the ACC external opponent (§9.5). */
  bowlingTeamId: string | null;
  bowlingTeamName: string;
  bowlingSideIsExternal: boolean;
  maxOversPerBowler: number | null;
  players: BowlerPickerPlayerRow[];
}

/** One bowling-side player selectable as a fielder (caught, run out, stumping). */
export interface FielderPickerPlayerRow {
  userId: string;
  firstName: string;
  lastName: string;
  profilePhotoUrl: string | null;
  isExternal: boolean;
  /** True when this player is the current bowler (caught & bowled). */
  isCurrentBowler: boolean;
}

/** Bowling squad list for the caught / run-out / stumped fielder picker. */
export interface FielderPickerResponse {
  matchId: string;
  inningsId: string;
  bowlingTeamId: string | null;
  bowlingTeamName: string;
  bowlingSideIsExternal: boolean;
  /**
   * External opponent only: true once ≥ {@link PLAYING_XI_SIZE} named opponents exist
   * (Playing 11 confirmed). When true, "Add Fielder by Name" should be hidden.
   */
  externalPlayingXiConfirmed: boolean;
  currentBowlerId: string | null;
  players: FielderPickerPlayerRow[];
}

/** Formats bowler figures as overs-maidens-runs-wickets (e.g. "4-0-24-2"). */
export function formatBowlerOmRw(
  card: Pick<BowlerCard, 'oversText' | 'maidens' | 'runsConceded' | 'wickets'>,
): string {
  return `${card.oversText}-${card.maidens}-${card.runsConceded}-${card.wickets}`;
}

/** Match sides needed to label a winner (registered teams + optional external name). */
export interface MatchWinnerNameContext {
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeTeamName?: string | null;
  awayTeamName?: string | null;
  externalOpponentName?: string | null;
}

type WinnerLabelInnings = Pick<InningsScorecard, 'battingTeamId' | 'battingIsExternal' | 'runs'>;

/**
 * Resolves the display name for the winning side.
 * Uses non-null id equality only — `null === null` must not map to "Away"
 * (ACC Leather vs external opponents use null battingTeamId / winningTeamId).
 */
export function resolveMatchWinnerDisplayName(
  match: MatchWinnerNameContext,
  result: Pick<MatchResultView, 'winningTeamId'>,
  innings: WinnerLabelInnings[] = [],
): string {
  const winnerId = result.winningTeamId;
  const homeName = match.homeTeamName?.trim() || 'Home';
  const awayName =
    match.awayTeamName?.trim() || match.externalOpponentName?.trim() || 'Away';
  const externalName = match.externalOpponentName?.trim() || null;

  if (winnerId != null && winnerId === match.homeTeamId) {
    return homeName;
  }
  if (winnerId != null && match.awayTeamId != null && winnerId === match.awayTeamId) {
    return awayName;
  }

  // Null winner id (external Leather): pick the batting side that took the deciding contest.
  const pair = decisiveNonTiedInningsPair(innings);
  if (winnerId == null && pair) {
    const [first, second] = pair;
    if (second.runs > first.runs) {
      return labelForBattingSide(match, second, homeName, awayName, externalName);
    }
    if (first.runs > second.runs) {
      return labelForBattingSide(match, first, homeName, awayName, externalName);
    }
  }

  return externalName ?? awayName;
}

/** Last non-tied innings pair (regulation or Super Over), oldest-pair index order. */
function decisiveNonTiedInningsPair(
  innings: WinnerLabelInnings[],
): [WinnerLabelInnings, WinnerLabelInnings] | null {
  for (let start = innings.length - 2; start >= 0; start -= 2) {
    const first = innings[start];
    const second = innings[start + 1];
    if (first && second && first.runs !== second.runs) {
      return [first, second];
    }
  }
  return null;
}

function labelForBattingSide(
  match: MatchWinnerNameContext,
  inn: WinnerLabelInnings,
  homeName: string,
  awayName: string,
  externalName: string | null,
): string {
  if (inn.battingIsExternal || (inn.battingTeamId == null && externalName)) {
    return externalName ?? awayName;
  }
  if (inn.battingTeamId != null && inn.battingTeamId === match.homeTeamId) {
    return homeName;
  }
  if (inn.battingTeamId != null && match.awayTeamId != null && inn.battingTeamId === match.awayTeamId) {
    return awayName;
  }
  return homeName;
}

/**
 * Rewrites persisted result lines that used generic Home/Away labels
 * (legacy bug when external winner had a null winningTeamId).
 */
export function replaceGenericHomeAwayInResultNote(
  resultNote: string,
  homeName: string,
  awayName: string,
): string {
  const note = resultNote.trim();
  if (note.startsWith('Away ')) {
    return `${awayName}${note.slice('Away'.length)}`;
  }
  if (note.startsWith('Home ')) {
    return `${homeName}${note.slice('Home'.length)}`;
  }
  return note;
}

/** Human-readable result line for match lists and completion banners. */
export function formatMatchResultNote(
  winnerName: string,
  result: Pick<
    MatchResultView,
    'decided' | 'marginRuns' | 'marginWickets' | 'isTie' | 'superOverRequired' | 'note'
  >,
): string | null {
  if (result.superOverRequired) {
    return result.note ?? 'Scores level — Super Over required';
  }
  if (result.isTie) {
    return 'Match tied';
  }
  if (!result.decided || !winnerName.trim()) {
    return null;
  }
  if (result.marginWickets != null && result.marginWickets >= 0) {
    const w = result.marginWickets;
    const line = `${winnerName} won by ${w} wicket${w === 1 ? '' : 's'}`;
    return result.note === 'Decided by Super Over' ? `${line} (Super Over)` : line;
  }
  if (result.marginRuns != null && result.marginRuns >= 0) {
    const r = result.marginRuns;
    const line = `${winnerName} won by ${r} run${r === 1 ? '' : 's'}`;
    return result.note === 'Decided by Super Over' ? `${line} (Super Over)` : line;
  }
  if (result.note === 'Decided by Super Over') {
    return `${winnerName} won (Super Over)`;
  }
  return `${winnerName} won`;
}

/**
 * Original first-innings score for a chase TOTAL bracket (e.g. "180/8 (205)").
 * Only for the second normal innings; Super Overs return null.
 */
export function originalFirstInningsRunsForChaseTotal(
  card: Pick<ScorecardResponse, 'innings'>,
  innings: Pick<InningsScorecard, 'inningsId' | 'inningsType' | 'sequence'>,
): number | null {
  if (innings.inningsType !== InningsType.Normal || innings.sequence <= 1) {
    return null;
  }
  const first = card.innings.find(
    (row) => row.inningsType === InningsType.Normal && row.sequence === 1,
  );
  if (!first || first.inningsId === innings.inningsId) {
    return null;
  }
  return first.runs;
}

/** Runs/wickets line; optional first-innings score in brackets, e.g. "180/8 (205)". */
export function formatInningsTotalScore(
  runs: number,
  wickets: number,
  originalFirstInningsRuns?: number | null,
): string {
  const base = `${runs}/${wickets}`;
  if (originalFirstInningsRuns == null) {
    return base;
  }
  return `${base} (${originalFirstInningsRuns})`;
}

/** Leather: only drops by ACC (registered) fielders — exclude external bowling side. */
export function filterDroppedCatchEventsForDisplay(
  ballType: BallType,
  innings: Pick<InningsScorecard, 'droppedCatchEvents' | 'bowlingIsExternal'>,
): DroppedCatchEventView[] {
  const events = innings.droppedCatchEvents ?? [];
  if (ballType === 'LEATHER' && innings.bowlingIsExternal) {
    return [];
  }
  return events;
}

export function buildDroppedCatchInningsLabel(
  innings: Pick<InningsScorecard, 'sequence' | 'inningsType'>,
  displayLabel: ScorecardInningsLabels | undefined,
): string {
  const batting = displayLabel?.battingTeamName ?? 'Batting side';
  if (innings.inningsType === InningsType.SuperOver) {
    return `Super Over — ${batting}`;
  }
  const ord =
    innings.sequence === 1 ? '1st' : innings.sequence === 2 ? '2nd' : `${innings.sequence}th`;
  return `${ord} Innings — ${batting}`;
}

export interface DroppedCatchInningsGroup {
  inningsId: string | null;
  label: string;
  events: DroppedCatchEventView[];
}

/** Chronological groups per innings for the live scoring dropped-catch card. */
export function collectLiveScoringDroppedCatchGroups(
  card: ScorecardResponse,
  ballType: BallType,
): DroppedCatchInningsGroup[] {
  const groups: DroppedCatchInningsGroup[] = [];
  for (let index = 0; index < card.innings.length; index += 1) {
    const innings = card.innings[index]!;
    const events = filterDroppedCatchEventsForDisplay(ballType, innings);
    if (events.length === 0) {
      continue;
    }
    groups.push({
      inningsId: innings.inningsId,
      label: buildDroppedCatchInningsLabel(innings, card.display.innings[index]),
      events,
    });
  }
  return groups;
}

export function formatDroppedCatchEventHeadline(
  event: DroppedCatchEventView,
  nameOf: (id: string | null | undefined) => string,
): string {
  const over = event.overBallLabel || '—';
  return `${nameOf(event.batsmanId)} - ${event.batsmanRuns} (${event.batsmanBalls})  |  Over ${over}`;
}

export function formatDroppedCatchEventDetail(
  event: DroppedCatchEventView,
  nameOf: (id: string | null | undefined) => string,
): string {
  return `${nameOf(event.bowlerId)} - dropped by ${nameOf(event.fielderId)}`;
}

/** Single-line fallback for compact contexts. */
export function formatDroppedCatchEventLine(
  event: DroppedCatchEventView,
  nameOf: (id: string | null | undefined) => string,
): string {
  return `${formatDroppedCatchEventHeadline(event, nameOf)}\n${formatDroppedCatchEventDetail(event, nameOf)}`;
}
