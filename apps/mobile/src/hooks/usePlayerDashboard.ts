import type { PlayerDashboard } from '@acc/types';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { getPlayerDashboard } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { dashboardFetchError, logFetchError } from '../lib/fetch-error';
import { canUsePlayerDashboard } from '../lib/player-dashboard-access';
import { subscribeMatchDataInvalidation } from '../lib/match-data-invalidation';
import { useUserScorerAssignedListener } from '../lib/user-socket';

export interface UsePlayerDashboardResult {
  dashboard: PlayerDashboard | null;
  isLoading: boolean;
  error: string | null;
  retry: () => void;
}

/** Fetches GET /player/dashboard on mount; exposes loading/error for DashboardScaffold. */
export function usePlayerDashboard(): UsePlayerDashboardResult {
  const { status, user } = useAuth();
  const [dashboard, setDashboard] = useState<PlayerDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;

    if (status !== 'authenticated' || !canUsePlayerDashboard(user)) {
      setDashboard(null);
      setError(null);
      setIsLoading(false);
      return () => {
        cancelled = true;
      };
    }

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
  }, [status, user]);

  useFocusEffect(load);
  useUserScorerAssignedListener(load);
  useEffect(() => subscribeMatchDataInvalidation(load), [load]);

  return { dashboard, isLoading, error, retry: load };
}
