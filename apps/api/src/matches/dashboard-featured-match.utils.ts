import {
  compareIsoDateOnly,
  deriveTournamentDisplayStatus,
  formatUtcIsoDate,
  isDashboardFeaturedMatchScheduledToday,
  MatchState,
  TournamentDisplayStatus,
  type MatchScheduleAnchor,
} from '@acc/types';

/** Max fixtures on role home dashboards for today's app-wide feed. */
export const DASHBOARD_TODAY_MATCHES_LIMIT = 10;

/** Guest/all-user Recent: keep matches whose `matchDate` is within this many days. */
export const DASHBOARD_RECENT_MATCH_MAX_AGE_DAYS = 30;

/** Dashboard Upcoming section: fixtures scheduled within this many days from now. */
export const DASHBOARD_UPCOMING_MATCH_WINDOW_DAYS = 7;

/** Pre-play fixture states — void once the parent tournament's calendar has ended. */
const UNPLAYED_DASHBOARD_MATCH_STATES: ReadonlySet<string> = new Set([
  MatchState.Scheduled,
  MatchState.PlayingXiLocked,
  MatchState.TossCompleted,
  MatchState.Delayed,
]);

type DashboardFeaturedMatchRow = MatchScheduleAnchor & {
  tournament: { timezone: string | null };
};

type DashboardTournamentSchedule = {
  startAt: Date | string;
  endAt: Date | string;
  timezone: string | null;
};

type DashboardCompletedTournamentMatchRow = {
  state: string;
  tournament: DashboardTournamentSchedule;
};

type DashboardTodayMatchRow = MatchScheduleAnchor & { id: string };

function readInstantMs(value: Date | string | null | undefined): number | null {
  if (value == null) {
    return null;
  }
  const ms = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

/** Sort key: scheduled start instant, then date-only anchor at noon UTC, else last. */
export function dashboardTodayMatchSortInstant(row: MatchScheduleAnchor): number {
  const startMs = readInstantMs(row.startTime);
  if (startMs != null) {
    return startMs;
  }
  if (row.matchDate != null) {
    const iso =
      typeof row.matchDate === 'string'
        ? row.matchDate.slice(0, 10)
        : formatUtcIsoDate(row.matchDate);
    return Date.parse(`${iso}T12:00:00.000Z`);
  }
  return Number.MAX_SAFE_INTEGER;
}

/**
 * Earliest scheduled time first; ties broken by match id (stable UUID order).
 */
export function compareDashboardTodayMatchesByTime(
  a: DashboardTodayMatchRow,
  b: DashboardTodayMatchRow,
): number {
  const instantDiff = dashboardTodayMatchSortInstant(a) - dashboardTodayMatchSortInstant(b);
  if (instantDiff !== 0) {
    return instantDiff;
  }
  return a.id.localeCompare(b.id);
}

/** Sort today's rows by time ascending and keep only the earliest `limit` fixtures. */
export function sortAndLimitDashboardTodayMatchRows<T extends DashboardTodayMatchRow>(
  rows: readonly T[],
  limit: number = DASHBOARD_TODAY_MATCHES_LIMIT,
): T[] {
  return [...rows].sort(compareDashboardTodayMatchesByTime).slice(0, limit);
}

/** Most recently scheduled / played first (for guest "recent" card). */
export function sortDashboardMatchesByTimeDesc<T extends DashboardTodayMatchRow>(
  rows: readonly T[],
): T[] {
  return [...rows].sort((a, b) => compareDashboardTodayMatchesByTime(b, a));
}

/** True when the match's schedule anchor is strictly after `now`. */
export function isDashboardMatchScheduledAfter(
  row: MatchScheduleAnchor,
  now: Date = new Date(),
): boolean {
  return dashboardTodayMatchSortInstant(row) > now.getTime();
}

/** End of the Upcoming window (`now` + {@link DASHBOARD_UPCOMING_MATCH_WINDOW_DAYS}). */
export function dashboardUpcomingMatchWindowEnd(
  now: Date = new Date(),
  windowDays: number = DASHBOARD_UPCOMING_MATCH_WINDOW_DAYS,
): Date {
  return new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000);
}

/**
 * True when schedule is in `(now, now+7d]` — later today included; past and >7d excluded.
 * Undated / TBD fixtures (no sortable anchor) are excluded.
 */
export function isDashboardMatchWithinUpcomingWindow(
  row: MatchScheduleAnchor,
  now: Date = new Date(),
): boolean {
  const instant = dashboardTodayMatchSortInstant(row);
  if (instant === Number.MAX_SAFE_INTEGER) {
    return false;
  }
  return instant > now.getTime() && instant <= dashboardUpcomingMatchWindowEnd(now).getTime();
}

/** Upcoming section: keep fixtures in the next 7 days, soonest→latest ready for sort. */
export function filterDashboardUpcomingMatchesBySchedule<T extends MatchScheduleAnchor>(
  rows: readonly T[],
  now: Date = new Date(),
): T[] {
  return rows.filter((row) => isDashboardMatchWithinUpcomingWindow(row, now));
}

/** Keeps dashboard featured cards scheduled for today only (venue-local calendar day). */
export function filterDashboardFeaturedMatchesToToday<T extends DashboardFeaturedMatchRow>(
  rows: readonly T[],
  now: Date = new Date(),
): T[] {
  return rows.filter((row) =>
    isDashboardFeaturedMatchScheduledToday(row, row.tournament.timezone, now),
  );
}

function toIsoInstant(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function matchDateOnly(row: MatchScheduleAnchor): string | null {
  if (row.matchDate == null) {
    return null;
  }
  if (typeof row.matchDate === 'string') {
    return row.matchDate.slice(0, 10);
  }
  return formatUtcIsoDate(row.matchDate);
}

/** True when the tournament's date-derived display status is Completed. */
export function isDashboardTournamentDisplayCompleted(
  tournament: DashboardTournamentSchedule,
  now: Date = new Date(),
): boolean {
  return (
    deriveTournamentDisplayStatus(
      {
        startAt: toIsoInstant(tournament.startAt),
        endAt: toIsoInstant(tournament.endAt),
        timezone: tournament.timezone,
      },
      now,
    ) === TournamentDisplayStatus.Completed
  );
}

/**
 * Rule 1: drop scheduled-but-unplayed fixtures whose tournament calendar has ended.
 * Played / live matches from a Completed tournament stay eligible.
 */
export function excludeUnplayedMatchesInCompletedTournaments<
  T extends DashboardCompletedTournamentMatchRow,
>(rows: readonly T[], now: Date = new Date()): T[] {
  return rows.filter((row) => {
    if (!UNPLAYED_DASHBOARD_MATCH_STATES.has(row.state)) {
      return true;
    }
    return !isDashboardTournamentDisplayCompleted(row.tournament, now);
  });
}

/** Inclusive UTC cutoff (`YYYY-MM-DD`) for the Recent window. */
export function dashboardRecentMatchDateCutoff(
  now: Date = new Date(),
  maxAgeDays: number = DASHBOARD_RECENT_MATCH_MAX_AGE_DAYS,
): string {
  const cutoff = new Date(now.getTime());
  cutoff.setUTCDate(cutoff.getUTCDate() - maxAgeDays);
  return formatUtcIsoDate(cutoff);
}

/** True when `matchDate` is on or after the 30-day Recent cutoff (UTC date-only). */
export function isDashboardMatchWithinRecentWindow(
  row: MatchScheduleAnchor,
  now: Date = new Date(),
): boolean {
  const dateOnly = matchDateOnly(row);
  if (!dateOnly) {
    return false;
  }
  return compareIsoDateOnly(dateOnly, dashboardRecentMatchDateCutoff(now)) >= 0;
}

/** Rule 2: Recent keeps only matches whose `matchDate` is within the last 30 days. */
export function filterDashboardRecentMatchesByMatchDate<T extends MatchScheduleAnchor>(
  rows: readonly T[],
  now: Date = new Date(),
): T[] {
  return rows.filter((row) => isDashboardMatchWithinRecentWindow(row, now));
}
