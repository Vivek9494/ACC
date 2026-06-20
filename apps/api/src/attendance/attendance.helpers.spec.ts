import {
  ATTENDANCE_CAPTURE_LEAD_HOURS,
  classifyAttendanceStatus,
  computeAttendanceCaptureWindow,
  GEOFENCE_RADIUS_METERS,
  isWithinGeofence,
  AttendancePunchStatus,
} from '@acc/types';

describe('attendance helpers', () => {
  const reportingTime = new Date('2025-06-14T13:00:00.000Z');
  const startTime = new Date('2025-06-14T18:00:00.000Z');

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
    expect(ATTENDANCE_CAPTURE_LEAD_HOURS).toBe(3);
  });
});
