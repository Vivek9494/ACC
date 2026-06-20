/**
 * Production geofence task for match attendance (Phase 1).
 * Region identifier format: `acc-match-{matchId}`.
 */
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { backgroundAutoPunch } from './attendance-punch-client';

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

TaskManager.defineTask(MATCH_GEOFENCE_TASK, async ({ data, error }) => {
  if (error) {
    console.log('[geofence] task error:', error.message);
    return;
  }

  const { eventType, region } = (data ?? {}) as GeofenceTaskData;
  if (eventType !== Location.GeofencingEventType.Enter) {
    return;
  }

  const matchId = parseMatchIdFromRegion(region?.identifier ?? '');
  if (!matchId) {
    return;
  }

  try {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    await backgroundAutoPunch(
      matchId,
      position.coords.latitude,
      position.coords.longitude,
    );
  } catch (err) {
    console.log('[geofence] enter handler failed', err);
  }
});
