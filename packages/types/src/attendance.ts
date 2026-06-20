import { DateTime } from 'luxon';

import { isMatchDayTodayInZone, type MatchScheduleAnchor } from './timezone';

/** Geofence radius around the match ground (§geofence attendance). */
export const GEOFENCE_RADIUS_METERS = 50;

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
  radiusMeters: number;
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
