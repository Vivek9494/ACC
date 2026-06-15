/**
 * Tournament Matches tab list cards — display state, ordering, and API shape.
 */

import { MatchState, type MatchState as MatchStateType } from './match';

/** UI bucket for a match card (distinct from the raw {@link MatchState} machine). */
export const MatchCardDisplayState = {
  Completed: 'COMPLETED',
  Live: 'LIVE',
  Scheduled: 'SCHEDULED',
} as const;
export type MatchCardDisplayState =
  (typeof MatchCardDisplayState)[keyof typeof MatchCardDisplayState];

export interface MatchListTeamView {
  id: string | null;
  name: string;
  logoUrl: string | null;
}

/** Populated from the scoring engine / live feed when a match is in progress. */
export interface MatchLiveScoreSummary {
  inningsNumber: number;
  runs: number;
  wickets: number;
  /** Decimal overs text, e.g. `"15.2"`. */
  oversText: string;
}

/** One row on GET /tournaments/:id/matches. */
export interface MatchListItem {
  id: string;
  tournamentId: string;
  matchCode: string | null;
  state: MatchStateType;
  displayState: MatchCardDisplayState;
  matchDate: string | null;
  startTime: string | null;
  teamA: MatchListTeamView;
  teamB: MatchListTeamView;
  groundLocation: string | null;
  /** Human result line, e.g. "Mumbai Mavericks won by 15 runs". Null until scoring finishes. */
  resultSummary: string | null;
  liveScore: MatchLiveScoreSummary | null;
  completedAt: string | null;
}

const COMPLETED_STATES: MatchStateType[] = [
  MatchState.Completed,
  MatchState.ScorecardLocked,
  MatchState.NoResult,
];

const LIVE_STATES: MatchStateType[] = [MatchState.Live, MatchState.RainInterrupted];

/** Chronological sort key: `startTime` when set, otherwise noon UTC on `matchDate`. */
export function parseMatchSortInstant(
  match: Pick<MatchListItem, 'startTime' | 'matchDate'>,
): number {
  if (match.startTime) {
    return Date.parse(match.startTime);
  }
  if (match.matchDate) {
    return Date.parse(`${match.matchDate}T12:00:00.000Z`);
  }
  return Number.MAX_SAFE_INTEGER;
}

/** Raw machine state → card bucket (COMPLETED, LIVE, or SCHEDULED). */
export function deriveMatchCardDisplayState(state: MatchStateType): MatchCardDisplayState {
  if (LIVE_STATES.includes(state)) {
    return MatchCardDisplayState.Live;
  }
  if (COMPLETED_STATES.includes(state)) {
    return MatchCardDisplayState.Completed;
  }
  return MatchCardDisplayState.Scheduled;
}

/** Oldest → newest by match datetime; `id` breaks ties for stable ordering. */
export function sortMatchesForDisplay(matches: readonly MatchListItem[]): MatchListItem[] {
  return [...matches].sort((a, b) => {
    const instantDiff = parseMatchSortInstant(a) - parseMatchSortInstant(b);
    if (instantDiff !== 0) {
      return instantDiff;
    }
    return a.id.localeCompare(b.id);
  });
}

/** Assign display buckets and sort chronologically (date, then time). */
export function prepareMatchListForDisplay(
  matches: readonly Omit<MatchListItem, 'displayState'>[],
): MatchListItem[] {
  const enriched: MatchListItem[] = matches.map((match) => ({
    ...match,
    displayState: deriveMatchCardDisplayState(match.state),
  }));
  return sortMatchesForDisplay(enriched);
}
