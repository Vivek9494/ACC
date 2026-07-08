import type { ActiveBroadcast } from '@acc/types';
import { useCallback, useEffect, useState } from 'react';

import { getActiveBroadcast } from '../lib/api';
import { logFetchError } from '../lib/fetch-error';

export interface UseActiveBroadcastResult {
  broadcast: ActiveBroadcast | null;
  reload: () => void;
}

/** Fetches the server-active broadcast (expiry enforced server-side). */
export function useActiveBroadcast(enabled = true): UseActiveBroadcastResult {
  const [broadcast, setBroadcast] = useState<ActiveBroadcast | null>(null);

  const load = useCallback(() => {
    if (!enabled) {
      setBroadcast(null);
      return;
    }
    void getActiveBroadcast()
      .then(setBroadcast)
      .catch((err: unknown) => {
        logFetchError('Failed to load active broadcast', err);
        setBroadcast(null);
      });
  }, [enabled]);

  useEffect(() => {
    load();
  }, [load]);

  return { broadcast, reload: load };
}
