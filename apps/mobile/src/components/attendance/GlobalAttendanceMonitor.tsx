import { useEffect, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import {
  foregroundAttendanceCheck,
  syncMatchGeofences,
} from '../../geofence/match-geofence';
import { useAuth } from '../../lib/auth-context';

/** Arms match geofences for every authenticated role (not only home/captain tabs). */
export function GlobalAttendanceMonitor(): null {
  const { status } = useAuth();
  const enabled = status === 'authenticated';

  const sync = useCallback(async (): Promise<void> => {
    if (!enabled) {
      return;
    }
    try {
      await syncMatchGeofences();
      await foregroundAttendanceCheck();
    } catch {
      // Best-effort; captain can manual-enter punch times.
    }
  }, [enabled]);

  useEffect(() => {
    void sync();
  }, [sync]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        void sync();
      }
    });
    return () => subscription.remove();
  }, [enabled, sync]);

  return null;
}
