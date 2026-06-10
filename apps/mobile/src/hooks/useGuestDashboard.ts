import type { GuestDashboard } from '@acc/types';
import { useCallback, useEffect, useState } from 'react';

import { getGuestDashboard } from '../lib/api';
import { dashboardFetchError, logFetchError } from '../lib/fetch-error';

export interface UseGuestDashboardResult {
  dashboard: GuestDashboard | null;
  isLoading: boolean;
  error: string | null;
  retry: () => void;
}

/** Fetches GET /guest/dashboard on mount — no auth token required (spec §2). */
export function useGuestDashboard(): UseGuestDashboardResult {
  const [dashboard, setDashboard] = useState<GuestDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    getGuestDashboard()
      .then((data) => {
        if (!cancelled) setDashboard(data);
      })
      .catch((err: unknown) => {
        logFetchError('Failed to load guest dashboard', err);
        if (!cancelled) {
          setError(dashboardFetchError(err));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return load();
  }, [load]);

  return { dashboard, isLoading, error, retry: load };
}
