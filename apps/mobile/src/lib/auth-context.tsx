import type { AuthResponse, AuthUser, LoginRequest, SignupRequest } from '@acc/types';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  getMe,
  isSessionExpiredError,
  login as apiLogin,
  logout as apiLogout,
  setAuthToken,
  setUnauthorizedHandler,
  signup as apiSignup,
} from './api';
import { clearTokens, loadTokens, saveTokens } from './session';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  signIn: (credentials: LoginRequest) => Promise<void>;
  register: (payload: SignupRequest) => Promise<void>;
  signOut: () => Promise<void>;
  /** Clears persisted tokens and local auth state without calling the logout API. */
  endSession: () => Promise<void>;
  /** Removes stored tokens only — keeps status authenticated (e.g. post password-change dialog). */
  clearCredentials: () => Promise<void>;
  /** Drops user/auth status after credentials are already cleared. */
  markUnauthenticated: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);

  const applySession = useCallback((response: AuthResponse) => {
    setAuthToken(response.tokens.accessToken);
    setUser(response.user);
    setStatus('authenticated');
  }, []);

  const clearSession = useCallback(async () => {
    await clearTokens();
    setAuthToken(null);
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const clearCredentials = useCallback(async () => {
    await clearTokens();
    setAuthToken(null);
  }, []);

  const markUnauthenticated = useCallback(() => {
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const signOut = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // Best-effort server invalidation; always clear local session.
    }
    await clearSession();
  }, [clearSession]);

  const signIn = useCallback(
    async (credentials: LoginRequest) => {
      const response = await apiLogin(credentials);
      await saveTokens(response.tokens);
      applySession(response);
    },
    [applySession],
  );

  const register = useCallback(
    async (payload: SignupRequest) => {
      const response = await apiSignup(payload);
      await saveTokens(response.tokens);
      applySession(response);
    },
    [applySession],
  );

  // Restore a persisted session on launch: try the stored access token; the
  // shared api client refreshes automatically on 401.
  useEffect(() => {
    let cancelled = false;

    async function bootstrap(): Promise<void> {
      const tokens = await loadTokens();
      if (!tokens) {
        if (!cancelled) setStatus('unauthenticated');
        return;
      }

      setAuthToken(tokens.accessToken);
      try {
        const me = await getMe();
        if (!cancelled) {
          setUser(me);
          setStatus('authenticated');
        }
      } catch (err) {
        if (cancelled) {
          return;
        }
        if (!isSessionExpiredError(err)) {
          await clearSession();
        }
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  // When refresh fails or tokenVersion mismatches, drop the session locally.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      void clearSession();
    });
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      signIn,
      register,
      signOut,
      endSession: clearSession,
      clearCredentials,
      markUnauthenticated,
    }),
    [status, user, signIn, register, signOut, clearSession, clearCredentials, markUnauthenticated],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
