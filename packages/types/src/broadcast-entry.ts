import { DateTime } from 'luxon';

import { LIVE_MATCH_STATES, PRE_LIVE_MATCH_STATES, type MatchState } from './match';
import type { BallType } from './rbac';
import { getMatchCalendarDayInZone, serverVenueTimezone } from './timezone';

/**
 * ASC Broadcast (Electron) entry: pick a date-Live tournament, then one of its
 * Live / upcoming matches, then open the cockpit.
 */

/** Admin / Club Manager see every Live tournament; everyone else only assigned ones. */
export const BroadcastEntryAccess = {
  All: 'ALL',
  Scorer: 'SCORER',
} as const;
export type BroadcastEntryAccess = (typeof BroadcastEntryAccess)[keyof typeof BroadcastEntryAccess];

export interface BroadcastEntryTournament {
  id: string;
  name: string;
  ballType: BallType;
}

export interface BroadcastEntryTournamentsResponse {
  access: BroadcastEntryAccess;
  tournaments: BroadcastEntryTournament[];
}

export const BroadcastEntryMatchStatus = {
  Live: 'LIVE',
  Upcoming: 'UPCOMING',
} as const;
export type BroadcastEntryMatchStatus =
  (typeof BroadcastEntryMatchStatus)[keyof typeof BroadcastEntryMatchStatus];

export interface BroadcastEntryMatch {
  id: string;
  teamAName: string;
  teamBName: string;
  /** ISO 8601 UTC. */
  matchDate: string | null;
  /** ISO 8601 UTC. */
  startTime: string | null;
  /** Tournament venue timezone (display only). */
  timezone: string | null;
  status: BroadcastEntryMatchStatus;
}

export const BROADCAST_ENTRY_NOT_ASSIGNED_MESSAGE =
  'You are not assigned to any Live tournament for scoring.';

/** Live (LIVE / RAIN_INTERRUPTED) or Upcoming (pre-live); null for ended / cancelled. */
export function broadcastEntryMatchStatus(state: MatchState): BroadcastEntryMatchStatus | null {
  if (LIVE_MATCH_STATES.includes(state)) {
    return BroadcastEntryMatchStatus.Live;
  }
  if (PRE_LIVE_MATCH_STATES.includes(state)) {
    return BroadcastEntryMatchStatus.Upcoming;
  }
  return null;
}

function scheduleMs(match: Pick<BroadcastEntryMatch, 'matchDate' | 'startTime'>): number {
  const iso = match.startTime ?? match.matchDate;
  const ms = iso ? Date.parse(iso) : Number.NaN;
  return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
}

/** Live first, then soonest scheduled; unscheduled last. */
export function compareBroadcastEntryMatches(a: BroadcastEntryMatch, b: BroadcastEntryMatch): number {
  const liveA = a.status === BroadcastEntryMatchStatus.Live ? 0 : 1;
  const liveB = b.status === BroadcastEntryMatchStatus.Live ? 0 : 1;
  if (liveA !== liveB) {
    return liveA - liveB;
  }
  const timeA = scheduleMs(a);
  const timeB = scheduleMs(b);
  if (timeA !== timeB) {
    return timeA < timeB ? -1 : 1;
  }
  return a.id.localeCompare(b.id);
}

/** "X vs Y | Sep 28 | Live" — date in the venue timezone. */
export interface BroadcastEntryMatchLabelParts {
  teamAName: string;
  teamBName: string;
  dateLabel: string;
  statusLabel: string;
}

export function broadcastEntryMatchLabelParts(
  match: BroadcastEntryMatch,
): BroadcastEntryMatchLabelParts {
  let dateLabel = 'Date TBD';
  if (match.startTime || match.matchDate) {
    const zone = serverVenueTimezone(match.timezone);
    const day = getMatchCalendarDayInZone(
      { matchDate: match.matchDate, startTime: match.startTime },
      zone,
    );
    dateLabel = DateTime.fromObject(day, { zone }).toFormat('LLL d');
  }
  const statusLabel = match.status === BroadcastEntryMatchStatus.Live ? 'Live' : 'Upcoming';
  return { teamAName: match.teamAName, teamBName: match.teamBName, dateLabel, statusLabel };
}

export function formatBroadcastEntryMatchLabel(match: BroadcastEntryMatch): string {
  const { teamAName, teamBName, dateLabel, statusLabel } = broadcastEntryMatchLabelParts(match);
  return `${teamAName} vs ${teamBName} | ${dateLabel} | ${statusLabel}`;
}
