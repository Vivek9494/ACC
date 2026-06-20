import { isWithinGeofence } from '@acc/types';
import * as Location from 'expo-location';

import { autoAttendancePunch, getAttendanceMonitoring } from '../lib/api';
import { MATCH_GEOFENCE_TASK, matchGeofenceRegionId } from './match-geofence-task';

/** Request foreground + background location for attendance geofencing. */
export async function ensureAttendanceLocationPermissions(): Promise<boolean> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') {
    return false;
  }
  const bg = await Location.requestBackgroundPermissionsAsync();
  return bg.status === 'granted';
}

/** Sync OS geofence regions from server monitoring targets. */
export async function syncMatchGeofences(): Promise<void> {
  const { targets } = await getAttendanceMonitoring();
  const active = targets.filter((target) => !target.hasPunched);

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
    if (started) {
      await Location.stopGeofencingAsync(MATCH_GEOFENCE_TASK);
    }
    return;
  }

  const granted = await ensureAttendanceLocationPermissions();
  if (!granted) {
    return;
  }

  await Location.startGeofencingAsync(MATCH_GEOFENCE_TASK, regions);
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
      accuracy: Location.Accuracy.Balanced,
    });
  } catch {
    return;
  }

  const { latitude, longitude } = position.coords;
  const capturedAt = new Date().toISOString();

  for (const target of pending) {
    if (
      isWithinGeofence(
        latitude,
        longitude,
        target.geofenceLat,
        target.geofenceLng,
        target.radiusMeters,
      )
    ) {
      try {
        await autoAttendancePunch(target.matchId, {
          latitude,
          longitude,
          capturedAt,
        });
      } catch {
        // Best-effort; captain can manual-enter.
      }
    }
  }
}
