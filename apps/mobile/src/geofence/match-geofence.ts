import { haversineDistanceMeters, isWithinGeofence, type AttendanceMonitoringTarget } from '@acc/types';
import * as Location from 'expo-location';

import { autoAttendancePunch, getAttendanceMonitoring } from '../lib/api';
import { MATCH_GEOFENCE_TASK, matchGeofenceRegionId } from './match-geofence-task';
import { geofenceLog } from './geofence-log';

/** Request foreground + background location for attendance geofencing. */
export async function ensureAttendanceLocationPermissions(): Promise<boolean> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') {
    geofenceLog('permission.foreground_denied', { status: fg.status });
    return false;
  }
  const bg = await Location.requestBackgroundPermissionsAsync();
  geofenceLog('permission.result', {
    foreground: fg.status,
    background: bg.status,
    backgroundGranted: bg.status === 'granted',
  });
  return bg.status === 'granted';
}

/** Log current permission levels without prompting (diagnostics). */
export async function logAttendancePermissionState(): Promise<void> {
  const [fg, bg] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync(),
  ]);
  geofenceLog('permission.current', {
    foreground: fg.status,
    background: bg.status,
    backgroundGranted: bg.status === 'granted',
  });
}

async function tryRecordPunchForTarget(
  target: AttendanceMonitoringTarget,
  latitude: number,
  longitude: number,
  reason: 'foreground' | 'already_inside' | 'geofence_enter',
): Promise<void> {
  const distanceM = haversineDistanceMeters(
    latitude,
    longitude,
    target.geofenceLat,
    target.geofenceLng,
  );
  const inPunchRadius = isWithinGeofence(
    latitude,
    longitude,
    target.geofenceLat,
    target.geofenceLng,
    target.punchRadiusMeters,
  );
  const inMonitorRadius = isWithinGeofence(
    latitude,
    longitude,
    target.geofenceLat,
    target.geofenceLng,
    target.radiusMeters,
  );

  geofenceLog('punch.check', {
    matchId: target.matchId,
    reason,
    distanceM: Math.round(distanceM),
    punchRadiusM: target.punchRadiusMeters,
    monitorRadiusM: target.radiusMeters,
    inPunchRadius,
    inMonitorRadius,
  });

  if (!inPunchRadius && !inMonitorRadius) {
    return;
  }

  try {
    const result = await autoAttendancePunch(target.matchId, {
      latitude,
      longitude,
      capturedAt: new Date().toISOString(),
      geofenceEnter: reason === 'geofence_enter' || (!inPunchRadius && inMonitorRadius),
    });
    geofenceLog('punch.recorded', {
      matchId: target.matchId,
      reason,
      status: result.status,
      alreadyRecorded: result.alreadyRecorded,
      punchTimeUtc: result.punchTimeUtc,
    });
  } catch (err) {
    geofenceLog('punch.failed', {
      matchId: target.matchId,
      reason,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** If already inside the monitor region when geofences start, record immediately (DP2). */
async function punchIfAlreadyInside(
  targets: AttendanceMonitoringTarget[],
): Promise<void> {
  const fg = await Location.getForegroundPermissionsAsync();
  if (fg.status !== 'granted') {
    geofenceLog('already_inside.skipped', { reason: 'foreground_permission_denied' });
    return;
  }

  let position: Location.LocationObject;
  try {
    position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
  } catch (err) {
    geofenceLog('already_inside.skipped', {
      reason: 'gps_unavailable',
      error: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  const { latitude, longitude } = position.coords;
  for (const target of targets) {
    const inMonitor = isWithinGeofence(
      latitude,
      longitude,
      target.geofenceLat,
      target.geofenceLng,
      target.radiusMeters,
    );
    if (inMonitor) {
      geofenceLog('already_inside.detected', {
        matchId: target.matchId,
        lat: target.geofenceLat,
        lng: target.geofenceLng,
      });
      await tryRecordPunchForTarget(target, latitude, longitude, 'already_inside');
    }
  }
}

/** Sync OS geofence regions from server monitoring targets. */
export async function syncMatchGeofences(): Promise<void> {
  await logAttendancePermissionState();

  const { targets } = await getAttendanceMonitoring();
  const active = targets.filter((target) => !target.hasPunched);

  geofenceLog('monitoring.targets', {
    total: targets.length,
    active: active.length,
    matches: active.map((t) => ({
      matchId: t.matchId,
      center: { lat: t.geofenceLat, lng: t.geofenceLng },
      monitorRadiusM: t.radiusMeters,
      punchRadiusM: t.punchRadiusMeters,
    })),
  });

  const regions: Location.LocationRegion[] = active.map((target) => ({
    identifier: matchGeofenceRegionId(target.matchId),
    latitude: target.geofenceLat,
    longitude: target.geofenceLng,
    radius: target.radiusMeters,
    notifyOnEnter: true,
    notifyOnExit: false,
  }));

  const started = await Location.hasStartedGeofencingAsync(MATCH_GEOFENCE_TASK);
  if (regions.length === 0) {
    geofenceLog('registration.skipped', { reason: 'no_active_targets', wasStarted: started });
    if (started) {
      await Location.stopGeofencingAsync(MATCH_GEOFENCE_TASK);
    }
    return;
  }

  const granted = await ensureAttendanceLocationPermissions();
  if (!granted) {
    geofenceLog('registration.failed', { reason: 'background_permission_not_granted' });
    return;
  }

  try {
    await Location.startGeofencingAsync(MATCH_GEOFENCE_TASK, regions);
    geofenceLog('registration.success', {
      task: MATCH_GEOFENCE_TASK,
      regionCount: regions.length,
      regions: regions.map((r) => ({
        id: r.identifier,
        lat: r.latitude,
        lng: r.longitude,
        radiusM: r.radius,
      })),
    });
  } catch (err) {
    geofenceLog('registration.failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  await punchIfAlreadyInside(active);
}

/** Foreground GPS check when the app opens near the ground. */
export async function foregroundAttendanceCheck(): Promise<void> {
  const fg = await Location.getForegroundPermissionsAsync();
  if (fg.status !== 'granted') {
    return;
  }

  const { targets } = await getAttendanceMonitoring();
  const pending = targets.filter((target) => !target.hasPunched);
  if (pending.length === 0) {
    return;
  }

  let position: Location.LocationObject;
  try {
    position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
  } catch {
    return;
  }

  const { latitude, longitude } = position.coords;
  for (const target of pending) {
    await tryRecordPunchForTarget(target, latitude, longitude, 'foreground');
  }
}
