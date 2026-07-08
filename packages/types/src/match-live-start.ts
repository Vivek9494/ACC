/**
 * Live / Start Match schedule gate (§11.1) — venue-local kickoff minus lead time.
 * Uses original scheduled datetime (not delayMinutes).
 */
import { formatVenueDateTime, type MatchScheduleAnchor } from './timezone';

export const LIVE_START_LEAD_MINUTES = 30;
export const LIVE_START_LEAD_MS = LIVE_START_LEAD_MINUTES * 60 * 1000;

function toDate(value: Date | string | null | undefined): Date | null {
  if (value == null) {
    return null;
  }
  return value instanceof Date ? value : new Date(value);
}

/** Scheduled kickoff instant (UTC). Prefers startTime, falls back to matchDate. */
export function matchScheduledKickoffInstant(match: MatchScheduleAnchor): Date | null {
  return toDate(match.startTime) ?? toDate(match.matchDate);
}

/** Earliest instant the assigned scorer may go Live (kickoff − 30 minutes). */
export function computeLiveStartAllowedAt(match: MatchScheduleAnchor): Date | null {
  const kickoff = matchScheduledKickoffInstant(match);
  if (!kickoff) {
    return null;
  }
  return new Date(kickoff.getTime() - LIVE_START_LEAD_MS);
}

export function isLiveStartTimeWindowOpen(
  match: MatchScheduleAnchor,
  now: Date = new Date(),
): boolean {
  const allowedAt = computeLiveStartAllowedAt(match);
  if (!allowedAt) {
    return false;
  }
  return now.getTime() >= allowedAt.getTime();
}

/** Venue-local display line for the unlock instant, e.g. `Jul 5 • 6:30 AM EDT`. */
export function formatLiveStartAllowedAtLine(
  match: MatchScheduleAnchor,
  timeZone: string,
): string | null {
  const allowedAt = computeLiveStartAllowedAt(match);
  if (!allowedAt) {
    return null;
  }
  return formatVenueDateTime(allowedAt, timeZone, { includeTime: true, includeZoneAbbrev: true });
}

export function liveStartTooEarlyMessage(
  match: MatchScheduleAnchor,
  timeZone: string,
): string {
  const displayLine = formatLiveStartAllowedAtLine(match, timeZone);
  return displayLine
    ? `Start Match is available from ${displayLine} (30 minutes before scheduled start)`
    : 'Start Match is not available yet (opens 30 minutes before scheduled start)';
}
