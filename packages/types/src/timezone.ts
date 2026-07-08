/**
 * IANA timezone helpers shared by api and mobile (spec §23).
 * Storage is always UTC; wall-clock rules use the tournament venue timezone.
 */
import { DateTime } from 'luxon';

import { formatUtcIsoDate, compareIsoDateOnly } from './tournament-dates';

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

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** YYYY-MM-DD for "today" in a venue IANA timezone (date-only; no UTC shift). */
export function formatTodayDateOnlyInZone(timeZone: string, now: Date = new Date()): string {
  const parts = getTodayCalendarPartsInZone(timeZone, now);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

/** True when `dateOnly` is strictly before today in `timeZone`. */
export function isDateOnlyBeforeTodayInZone(
  dateOnly: string,
  timeZone: string,
  now: Date = new Date(),
): boolean {
  return compareIsoDateOnly(dateOnly, formatTodayDateOnlyInZone(timeZone, now)) < 0;
}

/** Calendar year (venue-local) for "now" in `timeZone` — used for once-per-year de-dup keys. */
export function getYearInZone(timeZone: string, now: Date = new Date()): number {
  return getTodayCalendarPartsInZone(timeZone, now).year;
}

/** YYYY-MM-DD for "tomorrow" in a venue IANA timezone (date-only; DST-safe). */
export function formatTomorrowDateOnlyInZone(timeZone: string, now: Date = new Date()): string {
  const local = DateTime.fromJSDate(now, { zone: 'utc' }).setZone(timeZone).plus({ days: 1 });
  return `${local.year}-${pad2(local.month)}-${pad2(local.day)}`;
}

/**
 * True when a match's venue-local scheduled calendar day is tomorrow in `timeZone`
 * (date-only). Used by the day-before match reminder (§17 Phase C).
 */
export function isMatchDayTomorrowInZone(
  match: MatchScheduleAnchor,
  timeZone: string,
  now: Date = new Date(),
): boolean {
  if (toDate(match.startTime) == null && toDate(match.matchDate) == null) {
    return false;
  }
  const day = getMatchCalendarDayInZone(match, timeZone);
  const dayOnly = `${day.year}-${pad2(day.month)}-${pad2(day.day)}`;
  return compareIsoDateOnly(dayOnly, formatTomorrowDateOnlyInZone(timeZone, now)) === 0;
}

/**
 * True when `dateOfBirth`'s month+day equals today's month+day in `timeZone`
 * (year ignored). Feb 29 birthdays match Feb 29 only; in non-leap years the
 * birthday directory convention applies elsewhere.
 */
export function isBirthdayTodayInZone(
  dateOfBirth: Date | string,
  timeZone: string,
  now: Date = new Date(),
): boolean {
  const dob = toDate(dateOfBirth);
  if (dob == null) {
    return false;
  }
  // dateOfBirth is stored as UTC midnight; read its month/day in UTC to avoid a
  // backward zone shift moving it to the previous day.
  const dobUtc = DateTime.fromJSDate(dob, { zone: 'utc' });
  const today = getTodayCalendarPartsInZone(timeZone, now);
  return dobUtc.month === today.month && dobUtc.day === today.day;
}

/**
 * Local Date at start-of-today in `timeZone` for native date pickers.
 * Uses wall-clock calendar parts (device interprets as local midnight).
 */
export function startOfTodayForDatePicker(timeZone: string, now: Date = new Date()): Date {
  const parts = getTodayCalendarPartsInZone(timeZone, now);
  return new Date(parts.year, parts.month - 1, parts.day);
}

function calendarDayOrdinal(parts: { year: number; month: number; day: number }): number {
  return parts.year * 10_000 + parts.month * 100 + parts.day;
}

/**
 * True when the match's venue-local scheduled calendar day is strictly before today
 * in `timeZone` (date-only comparison; a fixture later today is not "past").
 */
export function isMatchScheduledDateBeforeTodayInZone(
  match: MatchScheduleAnchor,
  timeZone: string,
  now: Date = new Date(),
): boolean {
  if (toDate(match.startTime) == null && toDate(match.matchDate) == null) {
    return false;
  }
  const matchDay = getMatchCalendarDayInZone(match, timeZone);
  const today = getTodayCalendarPartsInZone(timeZone, now);
  return calendarDayOrdinal(matchDay) < calendarDayOrdinal(today);
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

/**
 * Dashboard featured-match cards: venue-local scheduled calendar day equals today
 * ({@link serverVenueTimezone}, default Ontario). Excludes past, future, and unscheduled fixtures.
 */
export function isDashboardFeaturedMatchScheduledToday(
  match: MatchScheduleAnchor,
  tournamentTimezone: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (toDate(match.startTime) == null && toDate(match.matchDate) == null) {
    return false;
  }
  return isMatchDayTodayInZone(match, serverVenueTimezone(tournamentTimezone), now);
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

/** Match detail screen: `28 June 2026 · 7:24 AM` in venue-local time. */
export function formatMatchDetailScheduleLabel(
  match: MatchScheduleAnchor,
  timeZone: string,
): string {
  const instant = toDate(match.startTime) ?? toDate(match.matchDate);
  if (!instant) {
    return '—';
  }

  const zoned = utcInstantToZonedDateTime(instant, timeZone);
  const datePart = zoned.toFormat('d MMMM yyyy');
  if (!match.startTime) {
    return datePart;
  }

  const timePart = zoned.toLocaleString(DateTime.TIME_SIMPLE);
  return `${datePart} · ${timePart}`;
}

/** Reporting-time row on match detail — same date/time pattern as schedule. */
export function formatMatchDetailReportingLabel(
  reportingTime: string | Date,
  timeZone: string,
): string {
  const zoned = utcInstantToZonedDateTime(reportingTime, timeZone);
  const datePart = zoned.toFormat('d MMMM yyyy');
  const timePart = zoned.toLocaleString(DateTime.TIME_SIMPLE);
  return `${datePart} · ${timePart}`;
}
