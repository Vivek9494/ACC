import type { AuthResponse, AuthUser, LoginRequest, SignupRequest } from '@acc/types';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  getMe,
  login as apiLogin,
  refreshTokens,
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

  const signOut = useCallback(async () => {
    await clearTokens();
    setAuthToken(null);
    setUser(null);
    setStatus('unauthenticated');
  }, []);

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

  // Restore a persisted session on launch: try the stored access token, and
  // if it has expired, fall back to one refresh before giving up.
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
        return;
      } catch {
        // fall through to a refresh attempt
      }

      try {
        const refreshed = await refreshTokens(tokens.refreshToken);
        await saveTokens(refreshed);
        setAuthToken(refreshed.accessToken);
        const me = await getMe();
        if (!cancelled) {
          setUser(me);
          setStatus('authenticated');
        }
      } catch {
        await clearTokens();
        setAuthToken(null);
        if (!cancelled) setStatus('unauthenticated');
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  // When the api reports a token-version mismatch, drop the session.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      void signOut();
    });
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, signIn, register, signOut }),
    [status, user, signIn, register, signOut],
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
