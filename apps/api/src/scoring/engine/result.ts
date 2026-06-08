import { InningsType, type InningsScorecard, type MatchResultView } from '@acc/types';

interface PairOutcome {
  decided: boolean;
  tie: boolean;
  winnerTeamId: string | null;
}

/**
 * Outcome of one batting contest (a normal match's two innings, or one Super
 * Over's two innings). The chasing side wins the moment it passes the target;
 * the defending side wins if the chase closes short; an equal closed chase ties.
 */
function evaluatePair(first?: InningsScorecard, second?: InningsScorecard): PairOutcome {
  if (!first || !second) {
    return { decided: false, tie: false, winnerTeamId: null };
  }
  if (second.runs > first.runs) {
    return { decided: true, tie: false, winnerTeamId: second.battingTeamId };
  }
  if (!second.closed) {
    return { decided: false, tie: false, winnerTeamId: null };
  }
  if (second.runs < first.runs) {
    return { decided: true, tie: false, winnerTeamId: first.battingTeamId };
  }
  return { decided: true, tie: true, winnerTeamId: null };
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
        superOverRequired: true,
        note: 'Scores level — Super Over required',
      };
    }
    res = evaluatePair(first, second);
    if (!res.decided && !res.tie) {
      return undecided;
    }
    idx += 1;
  }

  if (res.decided) {
    return {
      decided: true,
      isTie: false,
      isNoResult: false,
      winningTeamId: res.winnerTeamId,
      superOverRequired: false,
      note: idx > 0 ? 'Decided by Super Over' : null,
    };
  }
  return undecided;
}
