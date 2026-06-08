/**
 * Scoring engine contracts (spec §12, §14, §32) shared between the api and
 * mobile. The engine itself is an append-only event log: a {@link DeliveryType}
 * event is appended to an innings and all totals/figures are DERIVED by folding
 * over the event stream — never stored as mutable counters.
 */

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
export const PLAYERS_PER_TEAM = 11;
export const SUPER_OVER_OVERS = 1;
export const POINTS_WIN = 2;
export const POINTS_TIE_OR_NO_RESULT = 1;
export const POINTS_LOSS = 0;

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
  /** True for a 4/6 off the bat — boundaries never rotate strike (§32). */
  isBoundary?: boolean;
  dismissal?: DismissalInput | null;
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

// --- Derived read models ----------------------------------------------------

export interface BatterCard {
  playerId: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  isOut: boolean;
  dismissalType: DismissalType | null;
  bowlerId: string | null;
  fielderId: string | null;
}

export interface BowlerCard {
  playerId: string;
  legalBalls: number;
  oversText: string;
  runsConceded: number;
  wickets: number;
  maidens: number;
  economy: number;
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
  currentStrikerId: string | null;
  currentNonStrikerId: string | null;
  currentBowlerId: string | null;
  /** §12.1: the next legal delivery is a free hit (after any no-ball). */
  freeHitNext: boolean;
  closed: boolean;
  closeReason: InningsCloseReason | null;
  target: number | null;
}

export interface MatchResultView {
  decided: boolean;
  isTie: boolean;
  isNoResult: boolean;
  winningTeamId: string | null;
  /** True when a (further) Super Over is required to break a tie (§14). */
  superOverRequired: boolean;
  note: string | null;
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
}
