import { DateTime } from 'luxon';

import {
  getMatchCalendarDayInZone,
  isMatchDayTodayInZone,
  type MatchScheduleAnchor,
} from './timezone';

/** Punch verification radius — player must be within this distance to record (§geofence attendance). */
export const GEOFENCE_RADIUS_METERS = 50;

/**
 * Native OS geofence monitor radius (iOS is unreliable below ~100–150 m).
 * Used for region registration; punch may still verify at {@link GEOFENCE_RADIUS_METERS}
 * when GPS is available, or this radius on geofence-enter when GPS is unavailable.
 */
export const GEOFENCE_MONITOR_RADIUS_METERS = 150;

/** Default attendance capture window opens this many hours before reporting time. */
export const ATTENDANCE_CAPTURE_LEAD_HOURS = 3;

export const AttendancePunchSource = {
  Auto: 'AUTO',
  Manual: 'MANUAL',
} as const;
export type AttendancePunchSource =
  (typeof AttendancePunchSource)[keyof typeof AttendancePunchSource];

export const AttendancePunchStatus = {
  OnTime: 'ON_TIME',
  Late: 'LATE',
} as const;
export type AttendancePunchStatus =
  (typeof AttendancePunchStatus)[keyof typeof AttendancePunchStatus];

export type AttendanceMatchAnchor = MatchScheduleAnchor & {
  reportingTime: Date | string | null;
};

export interface AttendanceCaptureWindow {
  opensAt: Date;
  closesAt: Date;
}

/** Haversine distance in meters between two WGS-84 coordinates. */
export function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const earthRadiusM = 6_371_000;
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusM * Math.asin(Math.sqrt(a));
}

export function isWithinGeofence(
  lat: number,
  lng: number,
  centerLat: number,
  centerLng: number,
  radiusMeters: number = GEOFENCE_RADIUS_METERS,
): boolean {
  return haversineDistanceMeters(lat, lng, centerLat, centerLng) <= radiusMeters;
}

/**
 * Attendance capture window: {@link ATTENDANCE_CAPTURE_LEAD_HOURS} before reporting time
 * until match start (or reporting time when start is unset).
 */
export function computeAttendanceCaptureWindow(
  match: AttendanceMatchAnchor,
): AttendanceCaptureWindow | null {
  const reporting = toDate(match.reportingTime);
  if (!reporting) {
    return null;
  }
  const opensAt = new Date(reporting.getTime() - ATTENDANCE_CAPTURE_LEAD_HOURS * 3_600_000);
  const start = toDate(match.startTime);
  const closesAt = start ?? reporting;
  return { opensAt, closesAt };
}

export function isWithinAttendanceCaptureWindow(
  match: AttendanceMatchAnchor,
  now: Date = new Date(),
): boolean {
  const window = computeAttendanceCaptureWindow(match);
  if (!window) {
    return false;
  }
  return now >= window.opensAt && now <= window.closesAt;
}

export function isAttendanceMatchDay(
  match: MatchScheduleAnchor,
  timeZone: string,
  now: Date = new Date(),
): boolean {
  return isMatchDayTodayInZone(match, timeZone, now);
}

/** Classify ON_TIME vs LATE by comparing UTC instants (reporting time is stored UTC). */
export function classifyAttendanceStatus(
  punchTimeUtc: Date,
  reportingTimeUtc: Date,
): AttendancePunchStatus {
  return punchTimeUtc.getTime() <= reportingTimeUtc.getTime()
    ? AttendancePunchStatus.OnTime
    : AttendancePunchStatus.Late;
}

/** Format a punch instant for display, e.g. "9:15 AM". */
export function formatPunchTimeLabel(
  punchTimeUtc: string | Date,
  timeZone: string,
): string {
  const jsDate = typeof punchTimeUtc === 'string' ? new Date(punchTimeUtc) : punchTimeUtc;
  return DateTime.fromJSDate(jsDate, { zone: 'utc' }).setZone(timeZone).toFormat('h:mm a');
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (value == null) {
    return null;
  }
  return value instanceof Date ? value : new Date(value);
}

/**
 * Arrival is always on the match calendar day (venue TZ). Takes the picker's
 * instant, reads its venue-local hour/minute, and anchors them to that day.
 * Safe on both device (picker Date) and server (client-submitted ISO).
 */
export function composePunchTimeOnMatchDayUtc(
  match: MatchScheduleAnchor,
  timeZone: string,
  picked: Date,
): string {
  const day = getMatchCalendarDayInZone(match, timeZone);
  const wall = DateTime.fromJSDate(picked, { zone: 'utc' }).setZone(timeZone);
  const instant = DateTime.fromObject(
    {
      year: day.year,
      month: day.month,
      day: day.day,
      hour: wall.hour,
      minute: wall.minute,
      second: 0,
      millisecond: 0,
    },
    { zone: timeZone },
  );
  if (!instant.isValid) {
    throw new Error('Invalid punch time on match day');
  }
  return instant.toUTC().toISO()!;
}

/**
 * Seed value for the Edit Arrival Time picker.
 * Existing punch → that instant (re-anchored to match day if the stored day is wrong).
 * No punch → reporting time when present; else match-day noon in the venue zone.
 */
export function seedPunchPickerDate(params: {
  match: MatchScheduleAnchor;
  timeZone: string;
  reportingTime: Date | string | null;
  existingPunchUtc: Date | string | null;
}): Date {
  const { match, timeZone, reportingTime, existingPunchUtc } = params;
  const day = getMatchCalendarDayInZone(match, timeZone);
  const existing = toDate(existingPunchUtc);
  if (existing && !Number.isNaN(existing.getTime())) {
    const existingLocal = DateTime.fromJSDate(existing, { zone: 'utc' }).setZone(timeZone);
    if (
      existingLocal.year === day.year &&
      existingLocal.month === day.month &&
      existingLocal.day === day.day
    ) {
      return existing;
    }
    // Wrong calendar day (e.g. epoch clamp) — keep time-of-day, force match day.
    return DateTime.fromObject(
      {
        year: day.year,
        month: day.month,
        day: day.day,
        hour: existingLocal.hour,
        minute: existingLocal.minute,
        second: 0,
        millisecond: 0,
      },
      { zone: timeZone },
    ).toJSDate();
  }

  const reporting = toDate(reportingTime);
  if (reporting && !Number.isNaN(reporting.getTime())) {
    return reporting;
  }

  return DateTime.fromObject(
    {
      year: day.year,
      month: day.month,
      day: day.day,
      hour: 12,
      minute: 0,
      second: 0,
      millisecond: 0,
    },
    { zone: timeZone },
  ).toJSDate();
}

// --- API projections --------------------------------------------------------

export interface PunchTimePlayerRow {
  userId: string;
  firstName: string;
  lastName: string;
  profilePhotoUrl: string | null;
  /** Venue-local formatted arrival, e.g. "9:15 AM". Null when not arrived. */
  arrivedAtLabel: string | null;
  punchTimeUtc: string | null;
  source: AttendancePunchSource | null;
  status: AttendancePunchStatus | null;
  /** Captain verified a late punch (Phase 2 penalty input). */
  verifiedLate: boolean;
  /** Captain verified on-time penalty serve completion (designated server at serving match). */
  verifiedServeCompletion: boolean;
  editedFlag: boolean;
  /** Designated to serve a late-arrival penalty at this match (not in XI/subs). */
  isDesignatedServer: boolean;
}

/** Captain Punch Time attendance view for one team on a match. */
export interface PunchTimeAttendanceView {
  matchId: string;
  teamId: string;
  tournamentName: string;
  timezone: string | null;
  timezoneFallback: boolean;
  /** Both sides for the header card, e.g. "Barrie Cobras vs Scarborough Strikeforce". */
  matchTitle: string;
  homeTeamName: string;
  awayTeamName: string;
  reportingTime: string;
  reportingTimeLabel: string;
  /** Match calendar date (UTC midnight ISO) for arrival-day anchoring. */
  matchDate: string | null;
  /** Match start instant (UTC ISO); preferred over matchDate for local calendar day. */
  startTime: string | null;
  /** Players who punched (XI + subs). */
  playersPresentCount: number;
  /** Aggregate pill label, e.g. "On Time" when all arrived are on time. */
  aggregateStatusLabel: string;
  onTime: PunchTimePlayerRow[];
  notArrived: PunchTimePlayerRow[];
  late: PunchTimePlayerRow[];
}

export interface AutoAttendancePunchRequest {
  latitude: number;
  longitude: number;
  /** Client capture instant (ISO UTC); defaults to server now when omitted. */
  capturedAt?: string;
  /**
   * True when triggered by OS geofence enter (or register-while-inside fallback).
   * Server accepts the wider {@link GEOFENCE_MONITOR_RADIUS_METERS} when GPS is coarse.
   */
  geofenceEnter?: boolean;
}

export interface AutoAttendancePunchResponse {
  matchId: string;
  punchTimeUtc: string;
  status: AttendancePunchStatus;
  alreadyRecorded: boolean;
}

/** Captain manual enter or edit punch time. */
export interface SetAttendancePunchRequest {
  punchTimeUtc: string;
}

/** Active geofence monitoring target for a squad player on match day. */
export interface AttendanceMonitoringTarget {
  matchId: string;
  teamId: string;
  geofenceLat: number;
  geofenceLng: number;
  /** Native OS monitor region radius ({@link GEOFENCE_MONITOR_RADIUS_METERS}). */
  radiusMeters: number;
  /** Strict punch verification radius ({@link GEOFENCE_RADIUS_METERS}). */
  punchRadiusMeters: number;
  windowOpensAt: string;
  windowClosesAt: string;
  hasPunched: boolean;
}

export interface AttendanceMonitoringView {
  targets: AttendanceMonitoringTarget[];
}

/** Captain dashboard card to open Punch Time on match day. */
export interface CaptainPunchTimeCardView {
  matchId: string;
  teamId: string;
  matchTitle: string;
  tournamentName: string;
  playersPresentCount: number;
  aggregateStatusLabel: string;
}
