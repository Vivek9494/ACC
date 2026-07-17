import {
  InningsType,
  WICKETS_FOR_ALL_OUT,
  WICKETS_FOR_SUPER_OVER_ALL_OUT,
  type InningsScorecard,
  type MatchResultView,
} from '@acc/types';

interface PairOutcome {
  decided: boolean;
  tie: boolean;
  winnerTeamId: string | null;
  marginRuns: number | null;
  marginWickets: number | null;
}

/**
 * Outcome of one batting contest (a normal match's two innings, or one Super
 * Over's two innings). Uses the chase innings' target (runs to win) — including
 * a revised/DLS target — not a raw comparison of innings totals.
 *
 * - Chase wins when score >= target (by wickets remaining).
 * - Closed at exactly target - 1 → tie (Super Over).
 * - Closed further short → defending side wins by (target - 1 - chase) runs.
 */
function evaluatePair(
  first?: InningsScorecard,
  second?: InningsScorecard,
  maxWickets = WICKETS_FOR_ALL_OUT,
): PairOutcome {
  const none: PairOutcome = {
    decided: false,
    tie: false,
    winnerTeamId: null,
    marginRuns: null,
    marginWickets: null,
  };
  if (!first || !second) {
    return none;
  }
  // Prefer the folded chase target (revised/DLS or first+1); fall back for tests.
  const target = second.target ?? first.runs + 1;
  if (second.runs >= target) {
    const marginWickets = Math.max(0, maxWickets - second.wickets);
    return {
      decided: true,
      tie: false,
      winnerTeamId: second.battingTeamId,
      marginRuns: null,
      marginWickets,
    };
  }
  if (!second.closed) {
    return none;
  }
  if (second.runs === target - 1) {
    return {
      decided: true,
      tie: true,
      winnerTeamId: null,
      marginRuns: null,
      marginWickets: null,
    };
  }
  return {
    decided: true,
    tie: false,
    winnerTeamId: first.battingTeamId,
    marginRuns: target - 1 - second.runs,
    marginWickets: null,
  };
}

function toResultView(res: PairOutcome, note: string | null): MatchResultView {
  return {
    decided: res.decided,
    isTie: res.tie,
    isNoResult: false,
    winningTeamId: res.winnerTeamId,
    marginRuns: res.marginRuns,
    marginWickets: res.marginWickets,
    superOverRequired: false,
    note,
  };
}

/**
 * Derives the match result across the normal innings and any chained Super
 * Overs (§14). Returns `superOverRequired` when the latest contest is a tie and
 * no further Super Over innings exist yet.
 */
export function deriveMatchResult(innings: InningsScorecard[]): MatchResultView {
  const normals = innings
    .filter((i) => i.inningsType === InningsType.Normal)
    .sort((a, b) => a.sequence - b.sequence);
  const superOvers = innings
    .filter((i) => i.inningsType === InningsType.SuperOver)
    .sort((a, b) => a.sequence - b.sequence);

  const undecided: MatchResultView = {
    decided: false,
    isTie: false,
    isNoResult: false,
    winningTeamId: null,
    marginRuns: null,
    marginWickets: null,
    superOverRequired: false,
    note: null,
  };

  let res = evaluatePair(normals[0], normals[1]);
  if (!res.decided && !res.tie) {
    return undecided;
  }

  let idx = 0;
  while (res.tie) {
    const first = superOvers[idx * 2];
    const second = superOvers[idx * 2 + 1];
    if (!first || !second) {
      return {
        decided: false,
        isTie: false,
        isNoResult: false,
        winningTeamId: null,
        marginRuns: null,
        marginWickets: null,
        superOverRequired: true,
        note: 'Scores level — Super Over required',
      };
    }
    res = evaluatePair(first, second, WICKETS_FOR_SUPER_OVER_ALL_OUT);
    if (!res.decided && !res.tie) {
      return undecided;
    }
    idx += 1;
  }

  if (res.decided) {
    return toResultView(res, idx > 0 ? 'Decided by Super Over' : null);
  }
  return undecided;
}
