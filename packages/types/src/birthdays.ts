/** User row in the birthday directory (GET /birthdays). */
export interface BirthdayUserSummary {
  id: string;
  firstName: string;
  lastName: string;
  /** ISO date YYYY-MM-DD. */
  dateOfBirth: string;
  centerName: string | null;
  profilePhotoUrl: string | null;
}

/** @deprecated Use {@link BirthdayUserSummary}. */
export type TodayBirthdayUserSummary = BirthdayUserSummary;

export const BIRTHDAY_MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export interface BirthdayMonthGroup {
  month: number;
  label: string;
  users: BirthdayUserSummary[];
}

function parseIsoDateParts(isoDate: string): { month: number; day: number; year: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  return { year, month, day };
}

/** Display label for a stored YYYY-MM-DD birthdate. */
export function formatBirthdayDisplay(isoDate: string): string {
  const parts = parseIsoDateParts(isoDate);
  if (!parts) {
    return isoDate;
  }
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0, 0));
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** True when the birth month is the present month or later in the calendar year (UTC). */
export function isBirthMonthPresentOrUpcoming(
  isoDate: string,
  referenceDate: Date = new Date(),
): boolean {
  const parts = parseIsoDateParts(isoDate);
  if (!parts) {
    return false;
  }
  const presentMonth = referenceDate.getUTCMonth() + 1;
  return parts.month >= presentMonth;
}

/** Groups users by birth month from the present UTC month through December (no past months). */
export function groupBirthdaysByMonthFromPresent(
  users: readonly BirthdayUserSummary[],
  referenceDate: Date = new Date(),
): BirthdayMonthGroup[] {
  const presentMonth = referenceDate.getUTCMonth() + 1;
  const byMonth = new Map<number, BirthdayUserSummary[]>();

  for (const user of users) {
    const parts = parseIsoDateParts(user.dateOfBirth);
    if (!parts || parts.month < presentMonth) {
      continue;
    }
    const bucket = byMonth.get(parts.month) ?? [];
    bucket.push(user);
    byMonth.set(parts.month, bucket);
  }

  for (const bucket of byMonth.values()) {
    bucket.sort((a, b) => {
      const aParts = parseIsoDateParts(a.dateOfBirth);
      const bParts = parseIsoDateParts(b.dateOfBirth);
      const dayDiff = (aParts?.day ?? 0) - (bParts?.day ?? 0);
      if (dayDiff !== 0) {
        return dayDiff;
      }
      const last = a.lastName.localeCompare(b.lastName);
      if (last !== 0) {
        return last;
      }
      return a.firstName.localeCompare(b.firstName);
    });
  }

  const monthOrder: number[] = [];
  for (let month = presentMonth; month <= 12; month += 1) {
    monthOrder.push(month);
  }

  return monthOrder
    .filter((month) => (byMonth.get(month)?.length ?? 0) > 0)
    .map((month) => ({
      month,
      label: BIRTHDAY_MONTH_LABELS[month - 1] ?? String(month),
      users: byMonth.get(month)!,
    }));
}
