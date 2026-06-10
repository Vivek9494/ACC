import type { CenterSevakDashboard } from '@acc/types';
import { useCallback, useEffect, useState } from 'react';

import { getCenterSevakDashboard } from '../lib/api';
import { dashboardFetchError, logFetchError } from '../lib/fetch-error';

export interface UseCenterSevakDashboardResult {
  dashboard: CenterSevakDashboard | null;
  isLoading: boolean;
  error: string | null;
  retry: () => void;
}

/** Fetches GET /center-sevak/dashboard on mount; exposes loading/error for DashboardScaffold. */
export function useCenterSevakDashboard(): UseCenterSevakDashboardResult {
  const [dashboard, setDashboard] = useState<CenterSevakDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    getCenterSevakDashboard()
      .then((data) => {
        if (!cancelled) setDashboard(data);
      })
      .catch((err: unknown) => {
        logFetchError('Failed to load center sevak dashboard', err);
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
