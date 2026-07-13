import type { CaptainUpcomingMatchActions } from './captain-dashboard-actions';
import type { HomeAway, MatchState } from './match';
import type { CaptainPunchTimeCardView } from './attendance';
import type { ManagerPlayerStats, MatchSummaryTeamView } from './club-manager';
import type { CaptainPlayingXiCardView, ParticipationPollCardView } from './poll';
import type { ScorerStartableMatch } from './player';
import type { PendingScorecardConfirmationCardView } from './scorecard';
import type { TournamentSummary } from './tournament';
import {
  DEFAULT_VENUE_TIMEZONE,
  getMatchCalendarDayInZone,
} from './timezone';

/** Featured match presentation on the Captain / Vice-Captain home screen. */
export type CaptainFeaturedMatchStatus = 'UPCOMING' | 'LIVE' | 'COMPLETED';

/** Featured match for a captain's team (current or next fixture). */
export interface CaptainFeaturedMatchSummary {
  matchId: string;
  tournamentId: string;
  tournamentName: string;
  state: MatchState;
  status: CaptainFeaturedMatchStatus;
  teamA: MatchSummaryTeamView;
  teamB: MatchSummaryTeamView;
  /** Toss / pre-match line shown while live or before a result (blue text). */
  infoLine: string | null;
  /** Completed-match result line, e.g. "Barrie Cobras won by 40 runs". */
  resultLine: string | null;
  /** ACC ground-setup responsibility (§27); null on older fixtures. */
  homeAway: HomeAway | null;
  /** Schedule anchor for venue-local day grouping on the home dashboard. */
  matchDate: string | null;
  startTime: string | null;
  tournamentTimezone: string | null;
}

const FEATURED_MATCH_STATUS_BUCKET: Record<CaptainFeaturedMatchStatus, number> = {
  LIVE: 0,
  UPCOMING: 1,
  COMPLETED: 2,
};

/** Live first, then upcoming (soonest first), then completed (most recent first). */
export function sortFeaturedMatchesForDisplay(
  matches: readonly CaptainFeaturedMatchSummary[],
): CaptainFeaturedMatchSummary[] {
  return [...matches].sort((a, b) => {
    const bucketDiff = FEATURED_MATCH_STATUS_BUCKET[a.status] - FEATURED_MATCH_STATUS_BUCKET[b.status];
    if (bucketDiff !== 0) {
      return bucketDiff;
    }

    const aInstant = featuredMatchSortInstant(a);
    const bInstant = featuredMatchSortInstant(b);
    if (a.status === 'UPCOMING') {
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

function featuredMatchSortInstant(match: CaptainFeaturedMatchSummary): number {
  if (match.startTime) {
    return Date.parse(match.startTime);
  }
  if (match.matchDate) {
    return Date.parse(`${match.matchDate}T12:00:00.000Z`);
  }
  return Number.MAX_SAFE_INTEGER;
}

/** Featured matches on one venue-local scheduled calendar day. */
export interface FeaturedMatchDayGroup {
  /** `YYYY-MM-DD` in the match's venue timezone, or `__unscheduled__`. */
  dayKey: string;
  matches: CaptainFeaturedMatchSummary[];
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function featuredMatchScheduledDayKey(
  match: Pick<CaptainFeaturedMatchSummary, 'matchDate' | 'startTime' | 'tournamentTimezone'>,
): string {
  try {
    const timeZone = match.tournamentTimezone ?? DEFAULT_VENUE_TIMEZONE;
    const parts = getMatchCalendarDayInZone(match, timeZone);
    return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
  } catch {
    return '__unscheduled__';
  }
}

/**
 * Groups a sorted featured-match list by venue-local scheduled date.
 * Day groups appear in first-seen order (preserves {@link sortFeaturedMatchesForDisplay}).
 */
export function groupFeaturedMatchesByScheduledDay(
  matches: readonly CaptainFeaturedMatchSummary[],
): FeaturedMatchDayGroup[] {
  const groups: FeaturedMatchDayGroup[] = [];
  const groupIndexByKey = new Map<string, number>();

  for (const match of matches) {
    const dayKey = featuredMatchScheduledDayKey(match);
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

/** Completed match awaiting Man of the Match from the winning captain (§13.3). */
export interface CaptainPendingManOfMatch {
  matchId: string;
  teamName: string;
  resultLine: string | null;
  /** MoM selection is mandatory for registered winning teams. */
  required: boolean;
  /** End of the match calendar day (UTC ISO). */
  dueAt: string | null;
  /** Past deadline with no selection — still selectable. */
  overdue: boolean;
}

/** Currently assigned per-match Scorer, if any (§11.1). */
export interface AssignedScorerSummary {
  userId: string;
  firstName: string;
  lastName: string;
}

/**
 * Match the captain/organizer may assign a Scorer for during the pre-live window
 * (§11.1). Same card chrome as {@link ScorerStartableMatch}; button drives assign/switch.
 */
export interface CaptainScorerAssignmentMatch {
  matchId: string;
  tournamentName: string;
  dateTimeLine: string;
  teamA: MatchSummaryTeamView;
  teamB: MatchSummaryTeamView;
  assignedScorer: AssignedScorerSummary | null;
}

/** Captain-only upcoming leather match card with stacked prep actions. */
export interface CaptainUpcomingMatchCardView {
  matchId: string;
  teamId: string;
  tournamentName: string;
  dateTimeLine: string;
  venue: string | null;
  matchTitle: string;
  /** While the poll is open — captain votes inline on this card. */
  participationPoll: ParticipationPollCardView | null;
  /** After poll close — launches Confirm/Edit Playing XI. */
  playingXiEntry: { pollId: string; hasSavedSquad: boolean } | null;
  /** Pre-live scorer assignment for this match (populated when assign button may show). */
  scorerAssignment: CaptainScorerAssignmentMatch | null;
  /** Server-computed visibility for each stacked action button. */
  actions: CaptainUpcomingMatchActions;
}

/** Captain / Vice-Captain dashboard payload (GET /captain/dashboard). */
export interface CaptainDashboard {
  featuredMatches: CaptainFeaturedMatchSummary[];
  /** Captain-only unified upcoming leather match card; null for vice-captains. */
  upcomingMatchCard: CaptainUpcomingMatchCardView | null;
  /** Leather-ball participation poll for vice-captains (and when no unified card). */
  participationPoll: ParticipationPollCardView | null;
  /** @deprecated Folded into {@link upcomingMatchCard}. */
  playingXiCard: CaptainPlayingXiCardView | null;
  /** @deprecated Folded into {@link upcomingMatchCard}. */
  punchTimeCard: CaptainPunchTimeCardView | null;
  /** Most recent completed win still needing a MoM pick from this captain. */
  pendingManOfMatch: CaptainPendingManOfMatch | null;
  /** Completed matches awaiting this captain/VC's team scorecard confirmation (§13.1). */
  pendingScorecardConfirmations: PendingScorecardConfirmationCardView[];
  /** Pre-live fixture in the scorer-assignment window; null when none or outside window. */
  scorerAssignmentMatch: CaptainScorerAssignmentMatch | null;
  /** Active per-match scorer grant — Start/Continue Scoring card (§11.1). */
  scorerMatch: ScorerStartableMatch | null;
  /** Captains and VCs are always players — zeros allowed. */
  playerStats: ManagerPlayerStats;
  tournaments: TournamentSummary[];
}
