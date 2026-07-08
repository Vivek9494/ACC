import type { CaptainFeaturedMatchSummary, CaptainUpcomingMatchCardView } from './captain';
import type { HomeAway, MatchState } from './match';
import type { TournamentDashboardEntry } from './center-sevak';
import type { ParticipationPollCardView } from './poll';
import type { TournamentSummary } from './tournament';
import {
  DEFAULT_VENUE_TIMEZONE,
  getMatchCalendarDayInZone,
} from './timezone';

export type { TournamentDashboardEntry, TournamentDashboardPermissions } from './center-sevak';

/** One team row on the manager dashboard featured match card. */
export interface MatchSummaryTeamView {
  name: string;
  logoUrl: string | null;
  score: string | null;
  overs: string | null;
  isWinner: boolean;
}

/** Featured / most-recent match for the Club Manager home screen. */
export interface FeaturedMatchSummary {
  matchId: string;
  tournamentName: string;
  state: MatchState;
  teamA: MatchSummaryTeamView;
  teamB: MatchSummaryTeamView;
  /** Human result line, e.g. "Barrie Cobras won by 40 runs". Null when live/upcoming. */
  resultNote: string | null;
  isLive: boolean;
  isUpcoming: boolean;
  /** ACC ground-setup responsibility (§27); null on older fixtures. */
  homeAway: HomeAway | null;
  /** Schedule anchor for venue-local day grouping on the home dashboard. */
  matchDate: string | null;
  startTime: string | null;
  tournamentTimezone: string | null;
}

function featuredSummarySortInstant(
  match: Pick<FeaturedMatchSummary, 'matchDate' | 'startTime'>,
): number {
  if (match.startTime) {
    return Date.parse(match.startTime);
  }
  if (match.matchDate) {
    return Date.parse(`${match.matchDate}T12:00:00.000Z`);
  }
  return Number.MAX_SAFE_INTEGER;
}

function featuredSummaryBucket(match: FeaturedMatchSummary): number {
  if (match.isLive) {
    return 0;
  }
  if (match.isUpcoming) {
    return 1;
  }
  return 2;
}

/** Live first, then upcoming (soonest first), then completed (most recent first). */
export function sortFeaturedMatchSummariesForDisplay(
  matches: readonly FeaturedMatchSummary[],
): FeaturedMatchSummary[] {
  return [...matches].sort((a, b) => {
    const bucketDiff = featuredSummaryBucket(a) - featuredSummaryBucket(b);
    if (bucketDiff !== 0) {
      return bucketDiff;
    }

    const aInstant = featuredSummarySortInstant(a);
    const bInstant = featuredSummarySortInstant(b);
    if (a.isUpcoming) {
      const instantDiff = aInstant - bInstant;
      if (instantDiff !== 0) {
        return instantDiff;
      }
      return a.matchId.localeCompare(b.matchId);
    }

    const instantDiff = bInstant - aInstant;
    if (instantDiff !== 0) {
      return instantDiff;
    }
    return b.matchId.localeCompare(a.matchId);
  });
}

/** Featured matches on one venue-local scheduled calendar day. */
export interface FeaturedMatchSummaryDayGroup {
  /** `YYYY-MM-DD` in the match's venue timezone, or `__unscheduled__`. */
  dayKey: string;
  matches: FeaturedMatchSummary[];
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function featuredMatchSummaryScheduledDayKey(
  match: Pick<FeaturedMatchSummary, 'matchDate' | 'startTime' | 'tournamentTimezone'>,
): string {
  try {
    const timeZone = match.tournamentTimezone ?? DEFAULT_VENUE_TIMEZONE;
    const parts = getMatchCalendarDayInZone(match, timeZone);
    return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
  } catch {
    return '__unscheduled__';
  }
}

/** Groups a sorted featured-match list by venue-local scheduled date. */
export function groupFeaturedMatchSummariesByScheduledDay(
  matches: readonly FeaturedMatchSummary[],
): FeaturedMatchSummaryDayGroup[] {
  const groups: FeaturedMatchSummaryDayGroup[] = [];
  const groupIndexByKey = new Map<string, number>();

  for (const match of matches) {
    const dayKey = featuredMatchSummaryScheduledDayKey(match);
    const existingIndex = groupIndexByKey.get(dayKey);
    if (existingIndex !== undefined) {
      groups[existingIndex]!.matches.push(match);
      continue;
    }
    groupIndexByKey.set(dayKey, groups.length);
    groups.push({ dayKey, matches: [match] });
  }

  return groups;
}

/** Aggregated player stats for a manager who is also a registered player. */
export interface ManagerPlayerStats {
  matches: number;
  runs: number;
  wickets: number;
}

/** Club Manager dashboard payload (GET /club-manager/dashboard). */
export interface ClubManagerDashboard {
  featuredMatches: CaptainFeaturedMatchSummary[];
  /**
   * Unified upcoming leather match card when the CM is also Captain/VC of an ACC team.
   * Same chrome and timing as the captain dashboard.
   */
  upcomingMatchCard: CaptainUpcomingMatchCardView | null;
  /**
   * Standalone participation poll when no unified card is shown (e.g. vice-captain layout).
   */
  participationPoll: ParticipationPollCardView | null;
  /** Null when the manager has no tournament registration (not a player); zeros allowed. */
  playerStats: ManagerPlayerStats | null;
  tournaments: TournamentDashboardEntry[];
}
