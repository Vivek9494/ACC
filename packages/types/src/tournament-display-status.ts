import { compareIsoDateOnly, utcMidnightIsoToDateOnly } from './tournament-dates';
import { formatTodayDateOnlyInZone, serverVenueTimezone } from './timezone';

/** User-facing tournament status derived from schedule dates (not stored lifecycle state). */
export const TournamentDisplayStatus = {
  Upcoming: 'UPCOMING',
  Live: 'LIVE',
  Completed: 'COMPLETED',
  Cancelled: 'CANCELLED',
} as const;

export type TournamentDisplayStatus =
  (typeof TournamentDisplayStatus)[keyof typeof TournamentDisplayStatus];

export interface TournamentDisplayStatusInput {
  startAt: string;
  endAt: string;
  timezone?: string | null;
  cancelled?: boolean;
}

/**
 * Derives Upcoming / Live / Completed from venue-local calendar days.
 * - today < startDate → Upcoming (live at start-of-day on start date)
 * - startDate <= today <= endDate → Live (completed after end-of-day on last date)
 * - today > endDate → Completed
 * Cancelled overrides all date logic.
 */
export function deriveTournamentDisplayStatus(
  input: TournamentDisplayStatusInput,
  now: Date = new Date(),
): TournamentDisplayStatus {
  if (input.cancelled) {
    return TournamentDisplayStatus.Cancelled;
  }

  const zone = serverVenueTimezone(input.timezone);
  const today = formatTodayDateOnlyInZone(zone, now);
  const startDate = utcMidnightIsoToDateOnly(input.startAt);
  const endDate = utcMidnightIsoToDateOnly(input.endAt);

  if (compareIsoDateOnly(today, startDate) < 0) {
    return TournamentDisplayStatus.Upcoming;
  }
  if (compareIsoDateOnly(today, endDate) > 0) {
    return TournamentDisplayStatus.Completed;
  }
  return TournamentDisplayStatus.Live;
}

export function resolveTournamentDisplayStatus(
  tournament: TournamentDisplayStatusInput & { displayStatus?: TournamentDisplayStatus },
  options?: { cancelled?: boolean },
): TournamentDisplayStatus {
  return deriveTournamentDisplayStatus(
    {
      startAt: tournament.startAt,
      endAt: tournament.endAt,
      timezone: tournament.timezone,
      cancelled: options?.cancelled ?? tournament.cancelled,
    },
  );
}
