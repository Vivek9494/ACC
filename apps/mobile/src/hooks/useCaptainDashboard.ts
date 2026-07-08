import type { CaptainDashboard } from '@acc/types';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { getCaptainDashboard } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { canUseCaptainDashboard } from '../lib/captain-dashboard-access';
import { dashboardFetchError, logFetchError } from '../lib/fetch-error';
import { subscribeMatchDataInvalidation } from '../lib/match-data-invalidation';
import { useUserScorerAssignedListener } from '../lib/user-socket';

export interface UseCaptainDashboardResult {
  dashboard: CaptainDashboard | null;
  isLoading: boolean;
  error: string | null;
  retry: () => void;
}

/** Fetches GET /captain/dashboard on mount; exposes loading/error for DashboardScaffold. */
export function useCaptainDashboard(): UseCaptainDashboardResult {
  const { status, user } = useAuth();
  const [dashboard, setDashboard] = useState<CaptainDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;

    if (status !== 'authenticated' || !canUseCaptainDashboard(user)) {
      setDashboard(null);
      setError(null);
      setIsLoading(false);
      return () => {
        cancelled = true;
      };
    }

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
  }, [status, user]);

  useFocusEffect(load);
  useUserScorerAssignedListener(load);
  useEffect(() => subscribeMatchDataInvalidation(load), [load]);

  return { dashboard, isLoading, error, retry: load };
}
