import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import {
  foregroundAttendanceCheck,
  syncMatchGeofences,
} from '../geofence/match-geofence';

/** Arms geofences + runs a foreground punch check when authenticated screens focus. */
export function useAttendanceMonitor(enabled: boolean): void {
  useFocusEffect(
    useCallback(() => {
      if (!enabled) {
        return;
      }
      void (async () => {
        try {
          await syncMatchGeofences();
          await foregroundAttendanceCheck();
        } catch {
          // Monitoring is best-effort; manual entry remains available.
        }
      })();
    }, [enabled]),
  );
}
