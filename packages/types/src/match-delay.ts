import { DateTime } from 'luxon';

import { MatchState, isPreLiveMatchState, type MatchState as MatchStateType } from './match';
import { formatMatchDetailScheduleLabel } from './timezone';

/** Preset increments for the Match Detail "Delayed By" dropdown. */
export const MATCH_DELAY_DURATION_OPTIONS = [
  { value: 30, label: '30 mins' },
  { value: 45, label: '45 mins' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.30 hours' },
  { value: 120, label: '2 hours' },
  { value: 150, label: '2.30 hours' },
  { value: 180, label: '3 hours' },
] as const;

export const MATCH_DELAY_DURATION_MINUTES: readonly number[] = MATCH_DELAY_DURATION_OPTIONS.map(
  (option) => option.value,
);

export interface DelayMatchRequest {
  /** Minutes to add to the cumulative delay (one of {@link MATCH_DELAY_DURATION_MINUTES}). */
  delayMinutes: number;
}

export interface MatchScheduleWithDelay {
  matchDate: string | Date | null;
  startTime: string | Date | null;
  delayMinutes: number;
}

export function isAllowedMatchDelayIncrement(minutes: number): boolean {
  return MATCH_DELAY_DURATION_MINUTES.includes(minutes);
}

/**
 * Human-readable cumulative delay — handles preset totals and sums beyond 180
 * (e.g. 150 → "2.30 hours", 210 → "3.30 hours", 75 → "1 hour 15 mins").
 */
export function formatMatchDelayMinutes(totalMinutes: number): string {
  if (totalMinutes <= 0) {
    return '0 mins';
  }
  if (totalMinutes < 60) {
    return `${totalMinutes} mins`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const remainder = totalMinutes % 60;

  if (remainder === 0) {
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }
  if (remainder === 30) {
    return `${hours}.30 hours`;
  }

  const hourLabel = hours === 1 ? '1 hour' : `${hours} hours`;
  return `${hourLabel} ${remainder} mins`;
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (value == null) {
    return null;
  }
  return value instanceof Date ? value : new Date(value);
}

/** Effective start instant = original `startTime` + cumulative delay (UTC). */
export function resolveEffectiveStartTime(match: MatchScheduleWithDelay): Date | null {
  const start = toDate(match.startTime);
  if (!start || match.delayMinutes <= 0) {
    return start;
  }
  return new Date(start.getTime() + match.delayMinutes * 60_000);
}

/** Match Detail only — show the delay note while the fixture is still pre-live. */
export function shouldShowMatchDelayAnnotation(
  state: MatchStateType,
  delayMinutes: number,
): boolean {
  return delayMinutes > 0 && isPreLiveMatchState(state);
}

/** Match Detail Date & Time row — effective time plus optional delay annotation. */
export function formatMatchDetailScheduleWithDelay(
  match: MatchScheduleWithDelay,
  timeZone: string,
  state: MatchStateType,
): string {
  const effectiveStart = resolveEffectiveStartTime(match);
  const scheduleLabel = formatMatchDetailScheduleLabel(
    {
      matchDate: match.matchDate,
      startTime: effectiveStart,
    },
    timeZone,
  );

  if (!shouldShowMatchDelayAnnotation(state, match.delayMinutes)) {
    return scheduleLabel;
  }

  return `${scheduleLabel} (Match is delayed by ${formatMatchDelayMinutes(match.delayMinutes)})`;
}

/** ISO start time for list/card display (original + cumulative delay). */
export function resolveEffectiveStartTimeIso(
  match: Pick<MatchScheduleWithDelay, 'startTime' | 'delayMinutes'>,
): string | null {
  const effective = resolveEffectiveStartTime({
    matchDate: null,
    startTime: match.startTime,
    delayMinutes: match.delayMinutes,
  });
  return effective?.toISOString() ?? (match.startTime != null ? String(match.startTime) : null);
}

/** Venue-local date + time for match list cards (no delay annotation). */
export function formatMatchEffectiveListScheduleLabel(
  match: MatchScheduleWithDelay,
  timeZone: string,
): string {
  const effectiveStart = resolveEffectiveStartTime(match);
  if (!effectiveStart && !match.matchDate) {
    return '—';
  }

  if (!effectiveStart) {
    const iso =
      typeof match.matchDate === 'string'
        ? match.matchDate.slice(0, 10)
        : match.matchDate instanceof Date
          ? DateTime.fromJSDate(match.matchDate, { zone: 'utc' }).toISODate()
          : null;
    if (!iso) {
      return '—';
    }
    const zoned = DateTime.fromISO(iso, { zone: timeZone });
    return zoned.toFormat('MMMM d, yyyy');
  }

  const zoned = DateTime.fromJSDate(effectiveStart, { zone: 'utc' }).setZone(timeZone);
  const datePart = zoned.toFormat('MMMM d, yyyy');
  const timePart = zoned.toLocaleString(DateTime.TIME_SIMPLE);
  return `${datePart} · ${timePart}`;
}
