/**
 * Admin password-reset OTP analytics — UTC date-range helpers shared by api,
 * mobile and web-admin. All days are UTC calendar days `YYYY-MM-DD`.
 */

/** Longest inclusive range GET /admin/password-reset-otp/daily accepts. */
export const PASSWORD_RESET_OTP_MAX_RANGE_DAYS = 90;

/** Quick-pick ranges (days, inclusive of today) on the OTP graph. */
export const PASSWORD_RESET_OTP_RANGE_PRESETS = [7, 15, 30] as const;

export interface PasswordResetOtpDateRange {
  fromDate: string;
  toDate: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Today's UTC calendar day as `YYYY-MM-DD`. */
export function utcTodayIsoDate(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${pad2(now.getUTCMonth() + 1)}-${pad2(now.getUTCDate())}`;
}

/** Parses a strict `YYYY-MM-DD` into UTC midnight; null when malformed or not a real date. */
export function parseUtcIsoDate(value: string): Date | null {
  const match = ISO_DAY.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) {
    return null;
  }
  return date;
}

/** Inclusive UTC window ending today, spanning `dayCount` days. */
export function defaultPasswordResetOtpRange(
  dayCount = 7,
  now: Date = new Date(),
): PasswordResetOtpDateRange {
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - (dayCount - 1));
  return {
    fromDate: from.toISOString().slice(0, 10),
    toDate: to.toISOString().slice(0, 10),
  };
}

/** First/last UTC day of a calendar month (`monthIndex` 0–11). */
export function utcMonthDateRange(year: number, monthIndex: number): PasswordResetOtpDateRange {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return {
    fromDate: `${year}-${pad2(monthIndex + 1)}-01`,
    toDate: `${year}-${pad2(monthIndex + 1)}-${pad2(lastDay)}`,
  };
}

/** Days in an inclusive range; null when either bound is malformed. */
export function passwordResetOtpRangeDayCount(range: PasswordResetOtpDateRange): number | null {
  const from = parseUtcIsoDate(range.fromDate);
  const to = parseUtcIsoDate(range.toDate);
  if (!from || !to) {
    return null;
  }
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS) + 1;
}

/** User-facing reason a custom range would be rejected by the api, or null when valid. */
export function validatePasswordResetOtpRange(range: PasswordResetOtpDateRange): string | null {
  const days = passwordResetOtpRangeDayCount(range);
  if (days == null) {
    return 'Choose both a start and an end date.';
  }
  if (days < 1) {
    return 'Start date must be on or before the end date.';
  }
  if (days > PASSWORD_RESET_OTP_MAX_RANGE_DAYS) {
    return `Date range cannot exceed ${PASSWORD_RESET_OTP_MAX_RANGE_DAYS} days.`;
  }
  return null;
}

/** Short axis/heading label for a UTC day, e.g. "Sep 28". */
export function formatPasswordResetOtpDayLabel(isoDate: string): string {
  const date = parseUtcIsoDate(isoDate);
  if (!date) {
    return isoDate;
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
