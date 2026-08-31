import {
  BALLS_PER_OVER,
  groupTimelineByOver,
  type FallOfWicket,
  type InningsScorecard,
  type OverSummary,
} from '@acc/types';

export function currentRunRate(innings: InningsScorecard): string {
  if (innings.legalBalls <= 0) {
    return '0.00';
  }
  const rr = (innings.runs * BALLS_PER_OVER) / innings.legalBalls;
  return Number.isFinite(rr) ? rr.toFixed(2) : '0.00';
}

export function oversRemainingText(innings: InningsScorecard): string {
  if (innings.oversAllotted == null || innings.oversAllotted <= 0) {
    return '—';
  }
  const left = innings.oversAllotted * BALLS_PER_OVER - innings.legalBalls;
  if (left <= 0) {
    return '0.0';
  }
  const whole = Math.floor(left / BALLS_PER_OVER);
  const rem = left % BALLS_PER_OVER;
  return `${whole}.${rem}`;
}

export function lastFiveOversLine(innings: InningsScorecard): string {
  const overs = groupTimelineByOver(innings.timeline).slice(-5);
  if (overs.length === 0) {
    return '—';
  }
  const runs = overs.reduce((sum, over) => sum + over.runs, 0);
  const wickets = overs.reduce((sum, over) => sum + over.wickets, 0);
  return `${runs}/${wickets}`;
}

export function lastWicketLine(
  fow: FallOfWicket | undefined,
  nameOf: (id: string | null) => string,
): string {
  if (!fow) {
    return '—';
  }
  return `${fow.wicketNumber}-${fow.teamRuns} (${nameOf(fow.playerId)}, ${fow.oversText})`;
}

export function currentOverSummary(innings: InningsScorecard): OverSummary | null {
  const last = innings.recentOvers.at(-1);
  return last ?? null;
}

export function thisOverBallsText(innings: InningsScorecard): string {
  const over = currentOverSummary(innings);
  if (!over || over.balls.length === 0) {
    return '—';
  }
  return over.balls.join('  ');
}

/**
 * Boundary fours/sixes in the current unbroken partnership (both batters).
 * Counts timeline deliveries after the last wicket that are marked as boundaries.
 */
export function partnershipBoundaryCounts(innings: InningsScorecard): {
  fours: number;
  sixes: number;
} {
  const timeline = innings.timeline;
  let start = 0;
  for (let i = timeline.length - 1; i >= 0; i--) {
    if (timeline[i]?.isWicket) {
      start = i + 1;
      break;
    }
  }

  let fours = 0;
  let sixes = 0;
  for (let i = start; i < timeline.length; i++) {
    const entry = timeline[i];
    if (!entry?.isBoundary) continue;
    if (entry.code === '6' || entry.code.endsWith('6')) {
      sixes += 1;
    } else if (entry.code === '4' || entry.code.endsWith('4')) {
      fours += 1;
    }
  }
  return { fours, sixes };
}

/**
 * Boundary fours/sixes in the current unbroken partnership (both batters).
 * Counts timeline deliveries after the last wicket that are marked as boundaries.
 */
export function partnershipBoundaryCounts(innings: InningsScorecard): {
  fours: number;
  sixes: number;
} {
  const timeline = innings.timeline;
  let start = 0;
  for (let i = timeline.length - 1; i >= 0; i--) {
    if (timeline[i]?.isWicket) {
      start = i + 1;
      break;
    }
  }

  let fours = 0;
  let sixes = 0;
  for (let i = start; i < timeline.length; i++) {
    const entry = timeline[i];
    if (!entry?.isBoundary) continue;
    if (entry.code === '6' || entry.code.endsWith('6')) {
      sixes += 1;
    } else if (entry.code === '4' || entry.code.endsWith('4')) {
      fours += 1;
    }
  }
  return { fours, sixes };
}

export function extrasTypeFromCode(code: string): string {
  if (code.startsWith('Wd') || code.includes('Nb') || code.startsWith('Lb') || code.startsWith('pen')) {
    return code;
  }
  if (/^B\d/.test(code)) {
    return code;
  }
  return '—';
}

export function isExtraCode(code: string): boolean {
  return extrasTypeFromCode(code) !== '—';
}
