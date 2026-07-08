import { BallType } from './rbac';

/** YYYY-MM-DD calendar day (no time component). */
export const ISO_DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Format a Date as YYYY-MM-DD in local time. */
export function formatLocalIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Format a Date as YYYY-MM-DD in UTC. */
export function formatUtcIsoDate(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

export function isIsoDateOnly(value: string): boolean {
  const match = ISO_DATE_ONLY_PATTERN.exec(value);
  if (!match) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }
  return formatUtcIsoDate(parsed) === value;
}

/** Dedupe, validate format, and sort ascending. */
export function normalizeTournamentDates(dates: string[]): string[] {
  const unique = new Set<string>();
  for (const raw of dates) {
    const trimmed = raw.trim();
    if (!isIsoDateOnly(trimmed)) {
      throw new Error(`Invalid tournament date: ${raw}`);
    }
    unique.add(trimmed);
  }
  return [...unique].sort();
}

export function dateOnlyToUtcMidnightIso(date: string): string {
  return `${date}T00:00:00.000Z`;
}

/** Derive stored start/end from the selected tournament dates. */
export function deriveTournamentWindowFromDates(dates: string[]): {
  startAt: string;
  endAt: string;
} {
  const normalized = normalizeTournamentDates(dates);
  if (normalized.length === 0) {
    throw new Error('At least one tournament date is required');
  }
  const first = normalized[0] as string;
  const last = normalized[normalized.length - 1] as string;
  return {
    startAt: dateOnlyToUtcMidnightIso(first),
    endAt: dateOnlyToUtcMidnightIso(last),
  };
}

export function compareIsoDateOnly(a: string, b: string): number {
  return a.localeCompare(b);
}

/** True when the calendar day falls within an inclusive from/end span. */
export function isDateWithinLeatherSpan(
  dateOnly: string,
  fromDateOnly: string,
  endDateOnly: string,
): boolean {
  return (
    compareIsoDateOnly(dateOnly, fromDateOnly) >= 0 &&
    compareIsoDateOnly(dateOnly, endDateOnly) <= 0
  );
}

/** UTC midnight ISO (tournament startAt/endAt, matchDate) → YYYY-MM-DD without local tz shift. */
export function calendarDateFromUtcMidnightIso(iso: string): string {
  const trimmed = iso.trim();
  const direct = /^(\d{4}-\d{2}-\d{2})T00:00:00\.000Z$/.exec(trimmed);
  if (direct) {
    return direct[1] as string;
  }
  return formatUtcIsoDate(new Date(trimmed));
}

/** UTC midnight ISO (tournament startAt/endAt) → YYYY-MM-DD. */
export function utcMidnightIsoToDateOnly(iso: string): string {
  return calendarDateFromUtcMidnightIso(iso);
}

export interface TournamentFormDateInput {
  ballType: BallType | null;
  tournamentDates: string[];
  leatherFromDate: string;
  leatherEndDate: string;
}

/** Filter to valid YYYY-MM-DD strings, dedupe, and sort ascending. */
export function filterValidTournamentDates(dates: readonly string[]): string[] {
  const unique = new Set<string>();
  for (const raw of dates) {
    const trimmed = raw.trim();
    if (isIsoDateOnly(trimmed)) {
      unique.add(trimmed);
    }
  }
  return [...unique].sort();
}

/**
 * Single source of truth for tournament date selection on the form.
 * Tennis: multi-select days. Leather: inclusive from/end span boundaries.
 */
export function resolveTournamentFormDates(input: TournamentFormDateInput): string[] {
  if (input.ballType === BallType.Leather) {
    const fromDate = input.leatherFromDate.trim();
    const endDate = input.leatherEndDate.trim();
    if (!fromDate || !endDate) {
      return [];
    }
    if (compareIsoDateOnly(endDate, fromDate) < 0) {
      return [];
    }
    return filterValidTournamentDates([fromDate, endDate]);
  }
  return filterValidTournamentDates(input.tournamentDates);
}

/** Leather tournaments store a from/end span as sorted boundary dates. */
export function buildLeatherSpanDates(fromDate: string, endDate: string): string[] {
  if (!fromDate.trim() || !endDate.trim()) {
    throw new Error('Leather tournament span requires from and end dates');
  }
  if (compareIsoDateOnly(endDate, fromDate) < 0) {
    throw new Error('End date must be on or after from date');
  }
  return normalizeTournamentDates([fromDate, endDate]);
}

/** Expand inclusive UTC date range into YYYY-MM-DD strings. */
export function expandUtcDateRange(startAt: Date, endAt: Date): string[] {
  const dates: string[] = [];
  const cursor = new Date(startAt);
  cursor.setUTCHours(0, 0, 0, 0);
  const end = new Date(endAt);
  end.setUTCHours(0, 0, 0, 0);
  while (cursor.getTime() <= end.getTime()) {
    dates.push(formatUtcIsoDate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}
