import { DateTime } from 'luxon';

import type { MatchScheduleAnchor } from './timezone';
import { getMatchCalendarDayInZone, isMatchDayTodayInZone } from './timezone';

/** Show "View Punch Time" from this many ms before reporting time. */
export const PUNCH_TIME_VIEW_LEAD_MS = 60 * 60 * 1000;

export type CaptainMatchScheduleAnchor = MatchScheduleAnchor & {
  reportingTime: Date | string | null;
};

function toDate(value: Date | string | null | undefined): Date | null {
  if (value == null) {
    return null;
  }
  return value instanceof Date ? value : new Date(value);
}

function matchDayEndUtc(match: MatchScheduleAnchor, timeZone: string): Date {
  const { year, month, day } = getMatchCalendarDayInZone(match, timeZone);
  return DateTime.fromObject({ year, month, day }, { zone: timeZone })
    .endOf('day')
    .toUTC()
    .toJSDate();
}

/** True from 1 hour before reporting time onward (UTC instant comparison). */
export function isViewPunchTimeButtonVisible(
  match: Pick<CaptainMatchScheduleAnchor, 'reportingTime'>,
  now: Date = new Date(),
): boolean {
  const reporting = toDate(match.reportingTime);
  if (!reporting) {
    return false;
  }
  const opensAt = new Date(reporting.getTime() - PUNCH_TIME_VIEW_LEAD_MS);
  return now >= opensAt;
}

/** Assign/Switch Scorer button: venue-local match calendar day only. */
export function isAssignScorerButtonVisible(
  match: MatchScheduleAnchor,
  timeZone: string,
  now: Date = new Date(),
): boolean {
  return isMatchDayTodayInZone(match, timeZone, now);
}

/**
 * Confirmed List button: after poll close through end of match day (venue-local).
 * Includes days between poll close and match day (captain can confirm XI early).
 */
export function isConfirmedListButtonVisible(
  match: MatchScheduleAnchor,
  pollClosed: boolean,
  timeZone: string,
  now: Date = new Date(),
): boolean {
  if (!pollClosed) {
    return false;
  }
  return now <= matchDayEndUtc(match, timeZone);
}

export interface CaptainUpcomingMatchActions {
  showConfirmedList: boolean;
  showAssignScorer: boolean;
  showViewPunchTime: boolean;
}
