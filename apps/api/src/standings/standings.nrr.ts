import {
  BALLS_PER_OVER,
  InningsCloseReason,
  type StandingsInningsInput,
} from '@acc/types';

/** Accumulated runs and ball counts for NRR (work in balls; convert to overs at the end). */
export interface TeamNrrTotals {
  runsScored: number;
  ballsFaced: number;
  runsConceded: number;
  ballsBowled: number;
}

export function emptyNrrTotals(): TeamNrrTotals {
  return { runsScored: 0, ballsFaced: 0, runsConceded: 0, ballsBowled: 0 };
}

/**
 * Effective balls for an innings in NRR denominators. When the side is all out,
 * ICC counts the full allotted quota — not the balls actually faced.
 */
export function effectiveInningsBalls(input: {
  legalBalls: number;
  wasAllOut: boolean;
  oversAllotted: number | null;
}): number {
  const allottedBalls =
    input.oversAllotted != null && input.oversAllotted > 0
      ? input.oversAllotted * BALLS_PER_OVER
      : 0;
  if (input.wasAllOut && allottedBalls > 0) {
    return allottedBalls;
  }
  return input.legalBalls;
}

/** Convert cricket overs notation (X.Y legal balls in the over) to decimal overs. */
export function ballsToDecimalOvers(balls: number): number {
  return balls / BALLS_PER_OVER;
}

export function computeNetRunRate(totals: TeamNrrTotals): number {
  if (totals.ballsFaced <= 0 || totals.ballsBowled <= 0) {
    return 0;
  }
  const oversFaced = ballsToDecimalOvers(totals.ballsFaced);
  const oversBowled = ballsToDecimalOvers(totals.ballsBowled);
  return totals.runsScored / oversFaced - totals.runsConceded / oversBowled;
}

export function roundNetRunRate(nrr: number): number {
  return Math.round(nrr * 1000) / 1000;
}

/** Fold NORMAL innings into per-team NRR totals (excludes no-result matches upstream). */
export function accumulateInningsNrr(
  totals: Map<string, TeamNrrTotals>,
  innings: StandingsInningsInput[],
): void {
  for (const inn of innings) {
    const battingId = inn.battingTeamId;
    const bowlingId = inn.bowlingTeamId;
    const effectiveBalls = effectiveInningsBalls({
      legalBalls: inn.legalBalls,
      wasAllOut: inn.wasAllOut,
      oversAllotted: inn.oversAllotted,
    });

    if (battingId) {
      const row = totals.get(battingId) ?? emptyNrrTotals();
      row.runsScored += inn.runs;
      row.ballsFaced += effectiveBalls;
      totals.set(battingId, row);
    }

    if (bowlingId) {
      const row = totals.get(bowlingId) ?? emptyNrrTotals();
      row.runsConceded += inn.runs;
      row.ballsBowled += effectiveBalls;
      totals.set(bowlingId, row);
    }
  }
}

export function wasInningsAllOut(closeReason: InningsCloseReason | null): boolean {
  return closeReason === InningsCloseReason.AllOut;
}
