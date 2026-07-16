import { DateTime } from 'luxon';

import type { MatchScheduleAnchor } from './timezone';
import { getMatchCalendarDayInZone, isMatchDayTodayInZone } from './timezone';

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

/**
 * True from match reporting time onward (UTC instant comparison).
 * Reporting time is stored as a UTC instant derived from venue-local wall clock
 * (default America/Toronto); comparing instants is timezone-correct.
 */
export function isViewPunchTimeButtonVisible(
  match: Pick<CaptainMatchScheduleAnchor, 'reportingTime'>,
  now: Date = new Date(),
): boolean {
  const reporting = toDate(match.reportingTime);
  if (!reporting) {
    return false;
  }
  return now >= reporting;
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
  return isCaptainUpcomingMatchCardVisible(match, timeZone, now);
}

/**
 * Captain/CM Home upcoming match card (poll or Playing 11 prep).
 * Visible through end of the venue-local match calendar day, even if the match
 * is still in a prep state (Scheduled / Delayed / XI locked / Toss completed).
 */
export function isCaptainUpcomingMatchCardVisible(
  match: MatchScheduleAnchor,
  timeZone: string,
  now: Date = new Date(),
): boolean {
  return now <= matchDayEndUtc(match, timeZone);
}

export interface CaptainUpcomingMatchActions {
  showConfirmedList: boolean;
  showAssignScorer: boolean;
  showViewPunchTime: boolean;
}
