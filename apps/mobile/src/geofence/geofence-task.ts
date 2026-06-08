/**
 * THROWAWAY geofence proof-of-concept (Phase: §geofence attendance spike).
 *
 * Defines the background TaskManager task at MODULE scope so the OS can launch
 * the app straight into it when a region boundary is crossed — even if the app
 * was backgrounded or killed. This file must be imported once at startup
 * (see `app/_layout.tsx`) for kill-and-relaunch delivery to work.
 *
 * NOTE: geofencing + TaskManager do NOT run in Expo Go. You must use a
 * development build (`npx expo run:ios` / `npx expo run:android`).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

export const GEOFENCE_TASK = 'acc-geofence-poc';
export const GEOFENCE_REGION_ID = 'acc-poc-ground';
const LOG_KEY = 'acc-geofence-poc-log';
const MAX_LOG = 100;

export interface GeofenceLogEntry {
  type: 'enter' | 'exit' | 'error';
  timestampIso: string;
  regionId?: string;
  message?: string;
}

export async function appendLog(entry: GeofenceLogEntry): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(LOG_KEY);
    const list: GeofenceLogEntry[] = raw ? (JSON.parse(raw) as GeofenceLogEntry[]) : [];
    list.unshift(entry);
    await AsyncStorage.setItem(LOG_KEY, JSON.stringify(list.slice(0, MAX_LOG)));
  } catch {
    // Best-effort: never throw from the background task.
  }
}

export async function readLog(): Promise<GeofenceLogEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(LOG_KEY);
    return raw ? (JSON.parse(raw) as GeofenceLogEntry[]) : [];
  } catch {
    return [];
  }
}

export async function clearLog(): Promise<void> {
  await AsyncStorage.removeItem(LOG_KEY);
}

interface GeofenceTaskData {
  eventType: Location.GeofencingEventType;
  region: Location.LocationRegion;
}

// Registered at import time. Runs in a background JS context — it cannot touch
// React state, so it persists to AsyncStorage and fires a local notification.
TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
  const timestampIso = new Date().toISOString();

  if (error) {
    console.log('[geofence] task error:', error.message);
    await appendLog({ type: 'error', timestampIso, message: error.message });
    return;
  }

  const { eventType, region } = (data ?? {}) as GeofenceTaskData;
  const type = eventType === Location.GeofencingEventType.Enter ? 'enter' : 'exit';
  const regionId = region?.identifier ?? GEOFENCE_REGION_ID;

  console.log(`[geofence] ${type.toUpperCase()} ${regionId} @ ${timestampIso}`);
  await appendLog({ type, timestampIso, regionId });

  // Immediate field feedback while walking around with the phone locked.
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Geofence ${type === 'enter' ? 'ENTER' : 'EXIT'}`,
        body: `${regionId} at ${new Date(timestampIso).toLocaleTimeString()}`,
      },
      trigger: null,
    });
  } catch {
    // Notifications are a convenience; the AsyncStorage log is the source of truth.
  }
});
