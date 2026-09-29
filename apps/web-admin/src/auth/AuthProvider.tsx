import type { AuthResponse, AuthUser } from '@acc/types';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { ApiError, apiFetch, apiSend, onSessionEnded, refreshSession, tokenStore } from '@/lib/api-client';

import { dashboardAccessBlocker, SESSION_ENDED_MESSAGE } from './access';
import { AuthContext, type AuthContextValue, type AuthStatus, type LoginInput } from './auth-context';

/** Best-effort server logout (bumps tokenVersion), then drop local tokens. */
async function endServerSession(): Promise<void> {
  if (tokenStore.hasAccessToken()) {
    await apiSend('/auth/logout', { method: 'POST' }).catch(() => undefined);
  }
  tokenStore.clear();
}

export function AuthProvider({ children }: { children: ReactNode }): React.ReactElement {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const signOutLocally = useCallback(
    (message: string | null) => {
      tokenStore.clear();
      queryClient.clear();
      setUser(null);
      setStatus('unauthenticated');
      setNotice(message);
    },
    [queryClient],
  );

  useEffect(() => {
    onSessionEnded(() => signOutLocally(SESSION_ENDED_MESSAGE));
    return () => onSessionEnded(null);
  }, [signOutLocally]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!(await refreshSession())) {
        if (!cancelled) setStatus('unauthenticated');
        return;
      }
      try {
        const me = await apiFetch<AuthUser>('/auth/me');
        if (cancelled) return;
        const blocker = dashboardAccessBlocker(me);
        if (blocker) {
          await endServerSession();
          signOutLocally(blocker);
          return;
        }
        setUser(me);
        setStatus('authenticated');
      } catch {
        if (!cancelled) signOutLocally(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signOutLocally]);

  const login = useCallback(
    async ({ mobileNumber, password, rememberMe }: LoginInput) => {
      setNotice(null);
      const res = await apiFetch<AuthResponse>('/auth/login', {
        method: 'POST',
        body: { mobileNumber, password, rememberMe },
        auth: false,
      });
      tokenStore.set(res.tokens, rememberMe);
      const blocker = dashboardAccessBlocker(res.user);
      if (blocker) {
        await endServerSession();
        throw new ApiError(403, blocker, 'DASHBOARD_ACCESS_DENIED');
      }
      queryClient.clear();
      setUser(res.user);
      setStatus('authenticated');
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    await endServerSession();
    signOutLocally(null);
  }, [signOutLocally]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, notice, login, logout, clearNotice: () => setNotice(null) }),
    [status, user, notice, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
