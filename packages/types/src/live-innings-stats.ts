import { BALLS_PER_OVER } from './scoring';

/** Reference run rate shown beside the current-rate projection (runs per over). */
export const PROJECTED_SCORE_REFERENCE_RPO = 10;

/** Completed overs required before CRR / RRR rates are shown (avoids noisy early rates). */
export const LIVE_STATS_MIN_COMPLETED_OVERS = 3;

/** Legal balls required before rate stats appear (= {@link LIVE_STATS_MIN_COMPLETED_OVERS} overs). */
export const LIVE_STATS_MIN_LEGAL_BALLS = LIVE_STATS_MIN_COMPLETED_OVERS * BALLS_PER_OVER;

export interface LiveInningsRunStatsInput {
  runs: number;
  legalBalls: number;
  target: number | null;
}

export interface ChaseEquation {
  runsNeeded: number;
  ballsRemaining: number;
  remainingOvers: number;
  rrr: number | null;
  rrrText: string | null;
}

export interface LiveInningsRunStats {
  /** True once at least one legal ball has been bowled. */
  hasBowled: boolean;
  /** True once {@link LIVE_STATS_MIN_LEGAL_BALLS} completed — CRR / RRR numeric rates may show. */
  ratesReady: boolean;
  oversBowled: number;
  remainingOvers: number;
  totalOvers: number;
  crr: number;
  crrText: string;
  target: number | null;
  runsNeeded: number | null;
  ballsRemaining: number | null;
  rrr: number | null;
  rrrText: string | null;
  /** Human-readable chase equation fragment: "needs 69 runs from 38 balls". */
  chaseNeedsLine: string | null;
  isChase: boolean;
  projectedAtCurrent: number;
  projectedAtReferenceRpo: number;
}

/** Legal balls → overs as a real number (e.g. 112 balls → 18 + 4/6). */
export function oversFromLegalBalls(legalBalls: number): number {
  return legalBalls / BALLS_PER_OVER;
}

/**
 * True when legal balls already equal or exceed the revised over allotment
 * (the innings should fold as overs complete).
 */
export function isOversRevisionPastNewLimit(
  legalBalls: number,
  oversAllotted: number,
): boolean {
  return legalBalls >= oversAllotted * BALLS_PER_OVER;
}

/**
 * Whether a mid-innings overs revision is allowed. Any whole over count ≥ 1 is
 * valid; a value below whole overs already bowled is allowed only when the
 * innings is already at or past the new limit (rain reduction ends the innings).
 */
export function isOversRevisionAllowed(
  legalBalls: number,
  oversAllotted: number,
): boolean {
  if (!Number.isInteger(oversAllotted) || oversAllotted < 1) {
    return false;
  }
  return (
    oversAllotted >= minimumOversAllotmentFromLegalBalls(legalBalls) ||
    isOversRevisionPastNewLimit(legalBalls, oversAllotted)
  );
}

/**
 * Minimum total overs allowed after a rain revision — cannot set allotment below what has
 * already been bowled (partial overs count as the next whole over).
 */
export function minimumOversAllotmentFromLegalBalls(legalBalls: number): number {
  if (legalBalls <= 0) {
    return 1;
  }
  return Math.max(1, Math.ceil(legalBalls / BALLS_PER_OVER));
}

export function formatRunRate(rate: number): string {
  return rate.toFixed(2);
}

/** First non-null overs allotment — matches dashboard chase resolution order. */
export function resolveOversAllotment(
  primary: number | null | undefined,
  fallback?: number | null,
  fallback2?: number | null,
): number | null {
  return primary ?? fallback ?? fallback2 ?? null;
}

/**
 * Chase equation shared with the dashboard featured live card (runsNeeded / ballsRemaining / RRR).
 * `remainingOvers` uses fractional overs (balls / 6), never a rounded decimal overs figure.
 */
export function deriveChaseEquation(
  runs: number,
  legalBalls: number,
  target: number,
  totalOvers: number,
): ChaseEquation {
  const runsNeeded = Math.max(0, target - runs);
  const ballsRemaining = Math.max(0, totalOvers * BALLS_PER_OVER - legalBalls);
  const remainingOvers = Math.max(0, totalOvers - oversFromLegalBalls(legalBalls));
  const rrr = remainingOvers > 0 ? runsNeeded / remainingOvers : null;
  return {
    runsNeeded,
    ballsRemaining,
    remainingOvers,
    rrr,
    rrrText: rrr != null ? formatRunRate(rrr) : null,
  };
}

/** Chase line fragment without team name — e.g. "needs 69 runs from 38 balls". */
export function formatChaseNeedsLine(runsNeeded: number, ballsRemaining: number): string {
  const runWord = runsNeeded === 1 ? 'run' : 'runs';
  const ballWord = ballsRemaining === 1 ? 'ball' : 'balls';
  return `needs ${runsNeeded} ${runWord} from ${ballsRemaining} ${ballWord}`;
}

/**
 * Live header target text. When revised, always cites the ORIGINAL target
 * (first-innings total + 1), not the previous revision — e.g. "170 (was 180)".
 */
export function formatLiveTargetLabel(
  currentTarget: number | null | undefined,
  originalTarget: number | null | undefined,
): string | null {
  if (currentTarget == null) {
    return null;
  }
  if (originalTarget != null && originalTarget !== currentTarget) {
    return `${currentTarget} (was ${originalTarget})`;
  }
  return String(currentTarget);
}

/**
 * Derives CRR, chase equation, and projected final scores from engine totals.
 * `totalOvers` is the resolved match allotment (`oversPerInnings` / `oversAllotted`).
 */
export function deriveLiveInningsRunStats(
  innings: LiveInningsRunStatsInput,
  totalOvers: number | null,
  referenceRpo: number = PROJECTED_SCORE_REFERENCE_RPO,
): LiveInningsRunStats | null {
  if (totalOvers == null || totalOvers <= 0) {
    return null;
  }

  const oversBowled = oversFromLegalBalls(innings.legalBalls);
  const remainingOvers = Math.max(0, totalOvers - oversBowled);
  const isChase = innings.target != null;
  const ratesReady = innings.legalBalls >= LIVE_STATS_MIN_LEGAL_BALLS;
  const hasBowled = innings.legalBalls > 0;

  let runsNeeded: number | null = null;
  let ballsRemaining: number | null = null;
  let rrr: number | null = null;
  let rrrText: string | null = null;
  let chaseNeedsLine: string | null = null;

  if (isChase && innings.target != null) {
    const chase = deriveChaseEquation(
      innings.runs,
      innings.legalBalls,
      innings.target,
      totalOvers,
    );
    runsNeeded = chase.runsNeeded;
    ballsRemaining = chase.ballsRemaining;
    rrr = chase.rrr;
    rrrText = ratesReady ? chase.rrrText : null;
    chaseNeedsLine = formatChaseNeedsLine(chase.runsNeeded, chase.ballsRemaining);
  }

  if (!hasBowled) {
    return {
      hasBowled: false,
      ratesReady: false,
      oversBowled,
      remainingOvers,
      totalOvers,
      crr: 0,
      crrText: '-',
      target: innings.target,
      runsNeeded,
      ballsRemaining,
      rrr: null,
      rrrText: null,
      chaseNeedsLine,
      isChase,
      projectedAtCurrent: 0,
      projectedAtReferenceRpo: 0,
    };
  }

  const crr = innings.runs / oversBowled;
  const projectedAtCurrent = Math.round(innings.runs + crr * remainingOvers);
  const projectedAtReferenceRpo = Math.round(innings.runs + referenceRpo * remainingOvers);

  return {
    hasBowled: true,
    ratesReady,
    oversBowled,
    remainingOvers,
    totalOvers,
    crr,
    crrText: ratesReady ? formatRunRate(crr) : '-',
    target: innings.target,
    runsNeeded,
    ballsRemaining,
    rrr: ratesReady ? rrr : null,
    rrrText,
    chaseNeedsLine,
    isChase,
    projectedAtCurrent,
    projectedAtReferenceRpo,
  };
}
