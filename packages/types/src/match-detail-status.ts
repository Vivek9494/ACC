/**
 * Match Detail status buttons (§5.2) — single source of truth for UI and server.
 */

import {
  IN_PLAY_ONLY_STATUS_TARGETS,
  isPreLiveMatchState,
  MATCH_STATE_TRANSITIONS,
  MatchState,
  type MatchState as MatchStateType,
} from './match';
import {
  isMatchDayTodayInZone,
  isMatchScheduledDateBeforeTodayInZone,
  type MatchScheduleAnchor,
} from './timezone';
import {
  computeLiveStartAllowedAt,
  isLiveStartTimeWindowOpen,
  liveStartTooEarlyMessage,
  matchScheduledKickoffInstant,
} from './match-live-start';

export type MatchScheduleDayBucket = 'future' | 'match_day' | 'past' | 'unscheduled';

export interface MatchDetailStatusInput {
  state: MatchStateType;
  matchDate: string | Date | null;
  startTime: string | Date | null;
  /** Venue IANA timezone (e.g. America/Toronto). */
  timeZone: string;
  now?: Date;
}

const IN_PLAY_MATCH_DETAIL_STATUSES: MatchStateType[] = [
  MatchState.Live,
  MatchState.RainInterrupted,
  MatchState.Completed,
  MatchState.NoResult,
  MatchState.Cancelled,
];

/** Display order for pre-live match-day controls. */
export const MATCH_DETAIL_MATCH_DAY_STATUS_ORDER: MatchStateType[] = [
  MatchState.Delayed,
  MatchState.Live,
  MatchState.Cancelled,
];

function hasScheduleAnchor(match: MatchScheduleAnchor): boolean {
  return match.matchDate != null || match.startTime != null;
}

/**
 * Classify a fixture's scheduled calendar day vs today in the venue timezone
 * (date-only; uses {@link getTodayCalendarPartsInZone} / {@link getMatchCalendarDayInZone}).
 */
export function resolveMatchScheduleDayBucket(
  match: MatchScheduleAnchor,
  timeZone: string,
  now: Date = new Date(),
): MatchScheduleDayBucket {
  if (!hasScheduleAnchor(match)) {
    return 'unscheduled';
  }
  if (isMatchDayTodayInZone(match, timeZone, now)) {
    return 'match_day';
  }
  if (isMatchScheduledDateBeforeTodayInZone(match, timeZone, now)) {
    return 'past';
  }
  return 'future';
}

function preLiveMatchDayStatuses(state: MatchStateType): MatchStateType[] {
  const allowed = new Set<MatchStateType>();
  if (MATCH_STATE_TRANSITIONS[state].includes(MatchState.Live)) {
    allowed.add(MatchState.Live);
  }
  allowed.add(MatchState.Delayed);
  if (MATCH_STATE_TRANSITIONS[state].includes(MatchState.Cancelled)) {
    allowed.add(MatchState.Cancelled);
  }
  return MATCH_DETAIL_MATCH_DAY_STATUS_ORDER.filter((status) => allowed.has(status));
}

function preLiveOffMatchDayStatuses(state: MatchStateType): MatchStateType[] {
  return MATCH_STATE_TRANSITIONS[state].includes(MatchState.Cancelled)
    ? [MatchState.Cancelled]
    : [];
}

/**
 * Allowed Match Detail status buttons for the current state and schedule window.
 *
 * - Future / past / unscheduled + pre-live → Cancelled only
 * - Match day + pre-live → Delayed, Live (when graph allows), Cancelled
 * - Live / Rain Interrupted → in-play set (no Delayed)
 */
export function getMatchDetailStatusTransitions(input: MatchDetailStatusInput): MatchStateType[] {
  const { state, matchDate, startTime, timeZone, now = new Date() } = input;
  const schedule: MatchScheduleAnchor = { matchDate, startTime };

  if (state === MatchState.Live || state === MatchState.RainInterrupted) {
    return IN_PLAY_MATCH_DETAIL_STATUSES.filter((next) =>
      MATCH_STATE_TRANSITIONS[state].includes(next),
    );
  }

  if (!isPreLiveMatchState(state)) {
    return [];
  }

  const bucket = resolveMatchScheduleDayBucket(schedule, timeZone, now);
  if (bucket === 'match_day') {
    return preLiveMatchDayStatuses(state);
  }
  return preLiveOffMatchDayStatuses(state);
}

/**
 * Match-day + time-window gate for dedicated Live-start flows (start scoring / match setup)
 * that bypass the generic status transition graph (e.g. Playing XI Locked → Live).
 *
 * Requires now >= scheduled kickoff − 30 minutes in the venue timezone (original schedule;
 * delayMinutes is not applied — Delayed → Live clears delay).
 */
export function assertLiveStartAllowedOnSchedule(
  input: Pick<MatchDetailStatusInput, 'matchDate' | 'startTime' | 'timeZone' | 'now'>,
): { ok: true } | { ok: false; error: string; message: string } {
  const { matchDate, startTime, timeZone, now = new Date() } = input;
  const schedule: MatchScheduleAnchor = { matchDate, startTime };

  if (!matchScheduledKickoffInstant(schedule)) {
    return {
      ok: false,
      error: 'MATCH_UNSCHEDULED',
      message: 'Match has no scheduled start time',
    };
  }

  if (!isLiveStartTimeWindowOpen(schedule, now)) {
    return {
      ok: false,
      error: 'MATCH_START_TOO_EARLY',
      message: liveStartTooEarlyMessage(schedule, timeZone),
    };
  }

  return { ok: true };
}

export function validateMatchDetailStatusTransition(
  input: MatchDetailStatusInput & { target: MatchStateType },
): { ok: true } | { ok: false; error: string; message: string } {
  const { target, state, matchDate, startTime, timeZone, now } = input;

  if (!MATCH_STATE_TRANSITIONS[state].includes(target)) {
    return {
      ok: false,
      error: 'INVALID_STATE_TRANSITION',
      message: `Cannot transition from ${state} to ${target}`,
    };
  }

  const allowed = getMatchDetailStatusTransitions({
    state,
    matchDate,
    startTime,
    timeZone,
    now,
  });

  if (allowed.includes(target)) {
    return { ok: true };
  }

  if (isPreLiveMatchState(state) && IN_PLAY_ONLY_STATUS_TARGETS.includes(target)) {
    return {
      ok: false,
      error: 'MATCH_NOT_STARTED',
      message: `Cannot set the match to ${target} before it has started`,
    };
  }

  if (isPreLiveMatchState(state) && target === MatchState.Live) {
    return {
      ok: false,
      error: 'MATCH_NOT_MATCH_DAY',
      message: 'Live can only be set on match day',
    };
  }

  if (isPreLiveMatchState(state) && target === MatchState.Delayed) {
    return {
      ok: false,
      error: 'MATCH_NOT_MATCH_DAY',
      message: 'Delay can only be applied on match day',
    };
  }

  return {
    ok: false,
    error: 'STATUS_NOT_AVAILABLE',
    message: `Cannot set the match to ${target} in the current schedule window`,
  };
}
