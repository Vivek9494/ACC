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
