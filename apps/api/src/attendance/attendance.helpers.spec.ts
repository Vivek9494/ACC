import {
  ATTENDANCE_CAPTURE_LEAD_HOURS,
  classifyAttendanceStatus,
  composePunchTimeOnMatchDayUtc,
  computeAttendanceCaptureWindow,
  GEOFENCE_MONITOR_RADIUS_METERS,
  GEOFENCE_RADIUS_METERS,
  isWithinGeofence,
  AttendancePunchStatus,
  seedPunchPickerDate,
} from '@acc/types';

describe('attendance helpers', () => {
  const reportingTime = new Date('2025-06-14T13:00:00.000Z');
  const startTime = new Date('2025-06-14T18:00:00.000Z');
  const match = {
    matchDate: new Date('2025-06-14T00:00:00.000Z'),
    startTime,
  };
  const toronto = 'America/Toronto';

  it('computes capture window 3h before reporting until match start', () => {
    const window = computeAttendanceCaptureWindow({
      reportingTime,
      startTime,
      matchDate: new Date('2025-06-14T00:00:00.000Z'),
    });
    expect(window).not.toBeNull();
    expect(window!.opensAt.toISOString()).toBe('2025-06-14T10:00:00.000Z');
    expect(window!.closesAt.toISOString()).toBe(startTime.toISOString());
  });

  it('classifies on time when punch is at or before reporting', () => {
    expect(classifyAttendanceStatus(reportingTime, reportingTime)).toBe(
      AttendancePunchStatus.OnTime,
    );
    expect(
      classifyAttendanceStatus(new Date('2025-06-14T12:59:00.000Z'), reportingTime),
    ).toBe(AttendancePunchStatus.OnTime);
  });

  it('classifies late when punch is after reporting', () => {
    expect(
      classifyAttendanceStatus(new Date('2025-06-14T13:01:00.000Z'), reportingTime),
    ).toBe(AttendancePunchStatus.Late);
  });

  it('detects inside 50m geofence', () => {
    expect(isWithinGeofence(43.6532, -79.3832, 43.6532, -79.3832)).toBe(true);
    expect(isWithinGeofence(43.6532, -79.3832, 43.6532, -79.3832, 0)).toBe(true);
  });

  it('exports default geofence radius and lead hours', () => {
    expect(GEOFENCE_RADIUS_METERS).toBe(50);
    expect(GEOFENCE_MONITOR_RADIUS_METERS).toBe(150);
    expect(ATTENDANCE_CAPTURE_LEAD_HOURS).toBe(3);
  });

  it('composePunchTimeOnMatchDayUtc anchors picker wall-clock to match day', () => {
    // 5:30 PM EDT on an unrelated calendar day → same wall clock on match day.
    const picked = new Date('1970-01-01T21:30:00.000Z'); // 16:30 EST / would be 17:30 EDT
    const iso = composePunchTimeOnMatchDayUtc(match, toronto, picked);
    // January offset is EST (UTC-5) → wall 16:30; June match day is EDT → 16:30 EDT = 20:30Z
    expect(iso).toBe('2025-06-14T20:30:00.000Z');
  });

  it('composePunchTimeOnMatchDayUtc is idempotent for a match-day instant', () => {
    const onMatchDay = new Date('2025-06-14T21:30:00.000Z'); // 5:30 PM EDT
    expect(composePunchTimeOnMatchDayUtc(match, toronto, onMatchDay)).toBe(
      '2025-06-14T21:30:00.000Z',
    );
  });

  it('seedPunchPickerDate uses existing punch on match day as-is', () => {
    const existing = new Date('2025-06-14T21:45:00.000Z');
    const seeded = seedPunchPickerDate({
      match,
      timeZone: toronto,
      reportingTime,
      existingPunchUtc: existing,
    });
    expect(seeded.toISOString()).toBe(existing.toISOString());
  });

  it('seedPunchPickerDate re-anchors epoch punch onto match day', () => {
    const epochWrongDay = new Date('1970-01-01T21:30:00.000Z');
    const seeded = seedPunchPickerDate({
      match,
      timeZone: toronto,
      reportingTime,
      existingPunchUtc: epochWrongDay,
    });
    const recomposed = composePunchTimeOnMatchDayUtc(match, toronto, seeded);
    expect(recomposed).toBe('2025-06-14T20:30:00.000Z');
  });

  it('seedPunchPickerDate defaults to reporting time when no punch', () => {
    const seeded = seedPunchPickerDate({
      match,
      timeZone: toronto,
      reportingTime,
      existingPunchUtc: null,
    });
    expect(seeded.toISOString()).toBe(reportingTime.toISOString());
  });
});
