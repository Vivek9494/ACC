import type { InningsScorecard } from './scoring';
import { BallType, type BallType as BallTypeValue } from './rbac';
import {
  DEFAULT_VENUE_TIMEZONE,
  formatVenueDateTime,
} from './timezone';
import { resolveEffectiveStartTime } from './match-delay';
import {
  formatMatchListTeamScoreLine,
  MatchCardDisplayState,
  parseMatchSortInstant,
  type MatchCardDisplayState as MatchCardDisplayStateType,
} from './match-list';
import type { MatchState } from './match';

export const MY_MATCHES_BALL_TYPE_LABEL: Record<BallTypeValue, string> = {
  [BallType.Leather]: 'Leather Ball',
  [BallType.Tennis]: 'Tennis Ball',
};

/** One team row on a My Matches card — combined score/overs text. */
export interface MyMatchTeamView {
  id: string | null;
  name: string;
  logoUrl: string | null;
  /** e.g. `"203/5 (20.0)"` — null before innings start. */
  scoreLine: string | null;
  isWinner: boolean;
}

/** One match on GET /my-matches. */
export interface MyMatchListItem {
  id: string;
  tournamentId: string;
  tournamentName: string;
  ballType: BallTypeValue;
  /** IANA venue timezone when persisted on the tournament. */
  tournamentTimezone: string | null;
  state: MatchState;
  displayState: MatchCardDisplayStateType;
  matchDate: string | null;
  startTime: string | null;
  /** Cumulative pre-live delay in minutes. */
  delayMinutes: number;
  teamA: MyMatchTeamView;
  teamB: MyMatchTeamView;
  /** Completed: result text. Live: chase / live status. Scheduled: start time line. */
  footerLine: string | null;
  completedAt: string | null;
}

export interface MyMatchesTournamentOption {
  id: string;
  name: string;
  ballType: BallTypeValue;
}

/** Logged-in user's matches where they are in the posted Playing 11 (cancelled only when scored). */
export interface MyMatchesResponse {
  /** Distinct ball types present — client shows tabs only when length > 1. */
  ballTypes: BallTypeValue[];
  matches: MyMatchListItem[];
  /** Tournaments referenced by {@link matches} (for the filter dropdown). */
  tournaments: MyMatchesTournamentOption[];
}

/** Formats a team's innings total as `runs/wickets (overs)` for My Matches cards. */
export function formatMyMatchTeamScoreLine(
  innings: readonly Pick<InningsScorecard, 'runs' | 'wickets' | 'oversText' | 'closed'>[],
): string | null {
  return formatMatchListTeamScoreLine(innings);
}

const MY_MATCHES_DISPLAY_BUCKET: Record<MatchCardDisplayStateType, number> = {
  [MatchCardDisplayState.Live]: 0,
  [MatchCardDisplayState.Scheduled]: 1,
  [MatchCardDisplayState.Completed]: 2,
  [MatchCardDisplayState.Cancelled]: 3,
};

/**
 * Live first, then scheduled (soonest first), then completed (most recent first).
 */
export function sortMyMatchesForDisplay(matches: readonly MyMatchListItem[]): MyMatchListItem[] {
  return [...matches].sort((a, b) => {
    const bucketDiff =
      MY_MATCHES_DISPLAY_BUCKET[a.displayState] - MY_MATCHES_DISPLAY_BUCKET[b.displayState];
    if (bucketDiff !== 0) {
      return bucketDiff;
    }

    if (a.displayState === MatchCardDisplayState.Scheduled) {
      const instantDiff = parseMatchSortInstant(a) - parseMatchSortInstant(b);
      if (instantDiff !== 0) {
        return instantDiff;
      }
      return a.id.localeCompare(b.id);
    }

    const instantDiff = parseMatchSortInstant(b) - parseMatchSortInstant(a);
    if (instantDiff !== 0) {
      return instantDiff;
    }
    return b.id.localeCompare(a.id);
  });
}

/** Bottom-line text for a scheduled My Matches card. */
export function formatMyMatchScheduledFooterLine(
  match: Pick<MyMatchListItem, 'matchDate' | 'startTime' | 'tournamentTimezone' | 'delayMinutes'>,
): string {
  const displayZone = match.tournamentTimezone ?? DEFAULT_VENUE_TIMEZONE;
  const effectiveStart = resolveEffectiveStartTime({
    matchDate: match.matchDate,
    startTime: match.startTime,
    delayMinutes: match.delayMinutes,
  });
  if (effectiveStart) {
    const timeLabel = formatVenueDateTime(effectiveStart.toISOString(), displayZone, {
      includeWeekday: false,
      includeYear: false,
      includeTime: true,
      includeZoneAbbrev: true,
    });
    return `Starts ${timeLabel}`;
  }
  if (match.startTime) {
    const timeLabel = formatVenueDateTime(match.startTime, displayZone, {
      includeWeekday: false,
      includeYear: false,
      includeTime: true,
      includeZoneAbbrev: true,
    });
    return `Starts ${timeLabel}`;
  }
  if (match.matchDate) {
    const dateLabel = formatVenueDateTime(`${match.matchDate}T12:00:00.000Z`, displayZone, {
      includeWeekday: false,
      includeYear: true,
      includeTime: false,
    });
    return `Starts ${dateLabel}`;
  }
  return 'Scheduled';
}

export function filterMyMatchesByBallType(
  matches: readonly MyMatchListItem[],
  ballType: BallTypeValue,
): MyMatchListItem[] {
  return matches.filter((match) => match.ballType === ballType);
}

export function filterMyMatchesByTournament(
  matches: readonly MyMatchListItem[],
  tournamentId: string | null,
): MyMatchListItem[] {
  if (!tournamentId) {
    return [...matches];
  }
  return matches.filter((match) => match.tournamentId === tournamentId);
}

/** Tournament filter options for the active ball-type tab. */
export function myMatchTournamentOptionsForBallType(
  tournaments: readonly MyMatchesTournamentOption[],
  ballType: BallTypeValue,
): MyMatchesTournamentOption[] {
  return tournaments.filter((tournament) => tournament.ballType === ballType);
}
