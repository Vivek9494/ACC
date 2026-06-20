/**
 * IANA timezone helpers shared by api and mobile (spec §23).
 * Storage is always UTC; wall-clock rules use the tournament venue timezone.
 */
import { DateTime } from 'luxon';

import { formatUtcIsoDate } from './tournament-dates';

/** Server-side default when a tournament has no persisted venue timezone. */
export const DEFAULT_VENUE_TIMEZONE = 'America/Toronto';

export type MatchScheduleAnchor = {
  matchDate: Date | string | null;
  startTime: Date | string | null;
};

function toDate(value: Date | string | null | undefined): Date | null {
  if (value == null) {
    return null;
  }
  return value instanceof Date ? value : new Date(value);
}

/** True when `zone` is accepted by the environment's Intl implementation. */
export function isValidIanaTimezone(zone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** Zone used for server schedule math when the tournament has no persisted timezone. */
export function serverVenueTimezone(persistedTimezone: string | null | undefined): string {
  if (persistedTimezone && isValidIanaTimezone(persistedTimezone)) {
    return persistedTimezone;
  }
  return DEFAULT_VENUE_TIMEZONE;
}

/**
 * Display zone: venue when persisted, otherwise the viewer's device timezone.
 * Pass `deviceTimezone` from `Intl.DateTimeFormat().resolvedOptions().timeZone`.
 */
export function resolveDisplayTimezone(
  persistedTimezone: string | null | undefined,
  deviceTimezone: string,
): { timezone: string; timezoneFallback: boolean } {
  if (persistedTimezone && isValidIanaTimezone(persistedTimezone)) {
    return { timezone: persistedTimezone, timezoneFallback: false };
  }
  const fallback =
    deviceTimezone && isValidIanaTimezone(deviceTimezone)
      ? deviceTimezone
      : DEFAULT_VENUE_TIMEZONE;
  return { timezone: fallback, timezoneFallback: true };
}

/**
 * Calendar day for poll/match anchoring in a venue timezone.
 * Prefers {@link startTime}'s local date; otherwise the stored UTC calendar day.
 */
export function getMatchCalendarDayInZone(
  match: MatchScheduleAnchor,
  timeZone: string,
): { year: number; month: number; day: number } {
  const startTime = toDate(match.startTime);
  const matchDate = toDate(match.matchDate);

  if (startTime) {
    const local = DateTime.fromJSDate(startTime, { zone: 'utc' }).setZone(timeZone);
    return { year: local.year, month: local.month, day: local.day };
  }
  if (matchDate) {
    const iso =
      typeof match.matchDate === 'string' ? match.matchDate.slice(0, 10) : formatUtcIsoDate(matchDate);
    const local = DateTime.fromISO(iso, { zone: timeZone });
    return { year: local.year, month: local.month, day: local.day };
  }
  throw new Error('Match has no schedule anchor');
}

export function getTodayCalendarPartsInZone(
  timeZone: string,
  now: Date = new Date(),
): { year: number; month: number; day: number } {
  const local = DateTime.fromJSDate(now, { zone: 'utc' }).setZone(timeZone);
  return { year: local.year, month: local.month, day: local.day };
}

/** True when the match's venue-local calendar day is today in `timeZone`. */
export function isMatchDayTodayInZone(
  match: MatchScheduleAnchor,
  timeZone: string,
  now: Date = new Date(),
): boolean {
  const matchDay = getMatchCalendarDayInZone(match, timeZone);
  const today = getTodayCalendarPartsInZone(timeZone, now);
  return (
    matchDay.year === today.year && matchDay.month === today.month && matchDay.day === today.day
  );
}

export function utcInstantToZonedDateTime(iso: string | Date, timeZone: string): DateTime {
  const jsDate = typeof iso === 'string' ? new Date(iso) : iso;
  return DateTime.fromJSDate(jsDate, { zone: 'utc' }).setZone(timeZone);
}

/** Short zone label at an instant, e.g. `EDT` or `IST`. */
export function formatTimeZoneAbbrev(iso: string | Date, timeZone: string): string {
  const zoned = utcInstantToZonedDateTime(iso, timeZone);
  return zoned.offsetNameShort ?? zoned.toFormat('ZZZZ');
}

export interface FormatVenueDateTimeOptions {
  includeWeekday?: boolean;
  includeYear?: boolean;
  includeTime?: boolean;
  includeZoneAbbrev?: boolean;
}

/**
 * Formats a UTC instant in a venue timezone for display.
 * Example: `Thu, Jun 12 at 5:00 PM EDT`.
 */
export function formatVenueDateTime(
  iso: string | Date,
  timeZone: string,
  options: FormatVenueDateTimeOptions = {},
): string {
  const {
    includeWeekday = false,
    includeYear = false,
    includeTime = true,
    includeZoneAbbrev = false,
  } = options;
  const zoned = utcInstantToZonedDateTime(iso, timeZone);

  const datePart = zoned.toLocaleString({
    weekday: includeWeekday ? 'short' : undefined,
    month: 'short',
    day: 'numeric',
    year: includeYear ? 'numeric' : undefined,
  });

  if (!includeTime) {
    return datePart;
  }

  const timePart = zoned.toLocaleString(DateTime.TIME_SIMPLE).toUpperCase();
  if (includeZoneAbbrev) {
    const abbrev = formatTimeZoneAbbrev(iso, timeZone);
    return `${datePart} • ${timePart} ${abbrev}`;
  }
  return `${datePart} • ${timePart}`;
}

/** Dashboard scorer/poll line: `SAT, JUN 14 • 7:00 AM EDT`. */
export function formatMatchDateTimeLine(
  match: MatchScheduleAnchor,
  timeZone: string,
  options: { includeZoneAbbrev?: boolean } = {},
): string {
  const instant = toDate(match.startTime) ?? toDate(match.matchDate);
  if (!instant) {
    return '—';
  }

  const zoned = DateTime.fromJSDate(instant, { zone: 'utc' }).setZone(timeZone);
  const datePart = zoned
    .toLocaleString({ weekday: 'short', month: 'short', day: 'numeric' })
    .toUpperCase();

  if (!match.startTime) {
    return datePart;
  }

  const timePart = zoned.toLocaleString(DateTime.TIME_SIMPLE).toUpperCase();
  if (options.includeZoneAbbrev) {
    const abbrev = formatTimeZoneAbbrev(instant, timeZone);
    return `${datePart} • ${timePart} ${abbrev}`;
  }
  return `${datePart} • ${timePart}`;
}
