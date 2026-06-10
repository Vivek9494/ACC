import type { PlayerDashboard } from '@acc/types';
import { useCallback, useEffect, useState } from 'react';

import { getPlayerDashboard } from '../lib/api';
import { dashboardFetchError, logFetchError } from '../lib/fetch-error';

export interface UsePlayerDashboardResult {
  dashboard: PlayerDashboard | null;
  isLoading: boolean;
  error: string | null;
  retry: () => void;
}

/** Fetches GET /player/dashboard on mount; exposes loading/error for DashboardScaffold. */
export function usePlayerDashboard(): UsePlayerDashboardResult {
  const [dashboard, setDashboard] = useState<PlayerDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    getPlayerDashboard()
      .then((data) => {
        if (!cancelled) setDashboard(data);
      })
      .catch((err: unknown) => {
        logFetchError('Failed to load player dashboard', err);
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
