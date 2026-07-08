import {
  formatUtcIsoDate,
  isDashboardFeaturedMatchScheduledToday,
  type MatchScheduleAnchor,
} from '@acc/types';

/** Max fixtures on role home dashboards for today's app-wide feed. */
export const DASHBOARD_TODAY_MATCHES_LIMIT = 10;

type DashboardFeaturedMatchRow = MatchScheduleAnchor & {
  tournament: { timezone: string | null };
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

/** Keeps dashboard featured cards scheduled for today only (venue-local calendar day). */
export function filterDashboardFeaturedMatchesToToday<T extends DashboardFeaturedMatchRow>(
  rows: readonly T[],
  now: Date = new Date(),
): T[] {
  return rows.filter((row) =>
    isDashboardFeaturedMatchScheduledToday(row, row.tournament.timezone, now),
  );
}
