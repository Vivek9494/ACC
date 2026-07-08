/**
 * Production geofence task for match attendance (Phase 1).
 * Region identifier format: `acc-match-{matchId}`.
 */
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { backgroundAutoPunch } from './attendance-punch-client';
import { geofenceLog } from './geofence-log';

export const MATCH_GEOFENCE_TASK = 'acc-match-geofence';

export function matchGeofenceRegionId(matchId: string): string {
  return `acc-match-${matchId}`;
}

export function parseMatchIdFromRegion(regionId: string): string | null {
  const prefix = 'acc-match-';
  return regionId.startsWith(prefix) ? regionId.slice(prefix.length) : null;
}

interface GeofenceTaskData {
  eventType: Location.GeofencingEventType;
  region: Location.LocationRegion;
}

geofenceLog('task.registered', { task: MATCH_GEOFENCE_TASK });

TaskManager.defineTask(MATCH_GEOFENCE_TASK, async ({ data, error }) => {
  if (error) {
    geofenceLog('task.error', { message: error.message });
    return;
  }

  const { eventType, region } = (data ?? {}) as GeofenceTaskData;
  geofenceLog('task.event', {
    eventType,
    regionId: region?.identifier,
    lat: region?.latitude,
    lng: region?.longitude,
    radiusM: region?.radius,
  });

  if (eventType !== Location.GeofencingEventType.Enter) {
    return;
  }

  const matchId = parseMatchIdFromRegion(region?.identifier ?? '');
  if (!matchId) {
    geofenceLog('enter.skipped', { reason: 'unknown_region', regionId: region?.identifier });
    return;
  }

  geofenceLog('enter.received', { matchId });

  let latitude = region.latitude;
  let longitude = region.longitude;
  try {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    latitude = position.coords.latitude;
    longitude = position.coords.longitude;
    geofenceLog('enter.gps', { matchId, latitude, longitude });
  } catch (err) {
    geofenceLog('enter.gps_fallback', {
      matchId,
      reason: 'using_region_center',
      error: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    const result = await backgroundAutoPunch(matchId, latitude, longitude, true);
    if (result) {
      geofenceLog('enter.punch_result', {
        matchId,
        status: result.status,
        alreadyRecorded: result.alreadyRecorded,
      });
    } else {
      geofenceLog('enter.punch_failed', { matchId, reason: 'write_returned_null' });
    }
  } catch (err) {
    geofenceLog('enter.punch_failed', {
      matchId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});
