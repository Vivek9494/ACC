import type { CaptainDashboard } from '@acc/types';
import { useCallback, useEffect, useState } from 'react';

import { getCaptainDashboard } from '../lib/api';
import { dashboardFetchError, logFetchError } from '../lib/fetch-error';

export interface UseCaptainDashboardResult {
  dashboard: CaptainDashboard | null;
  isLoading: boolean;
  error: string | null;
  retry: () => void;
}

/** Fetches GET /captain/dashboard on mount; exposes loading/error for DashboardScaffold. */
export function useCaptainDashboard(): UseCaptainDashboardResult {
  const [dashboard, setDashboard] = useState<CaptainDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    getCaptainDashboard()
      .then((data) => {
        if (!cancelled) setDashboard(data);
      })
      .catch((err: unknown) => {
        logFetchError('Failed to load captain dashboard', err);
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
