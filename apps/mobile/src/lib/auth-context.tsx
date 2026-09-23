import type { AuthResponse, AuthUser, LoginRequest, ProfileDetail, SignupRequest } from '@acc/types';
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
import { registerDeviceForPush, unregisterDeviceForPush } from './push-registration';
import { clearTokens, loadRefreshToken, loadTokens, saveTokens } from './session';
import { clearRememberMePreferences } from './remember-me';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

/** Optional post-signup work (e.g. profile photo) before the app treats the session as active. */
export interface RegisterOptions {
  /**
   * Runs after tokens are saved (API calls are authenticated) but BEFORE
   * `status` becomes `authenticated` — so the root redirect to home waits.
   * On failure, signup still completes with the original signup user payload.
   */
  beforeActivate?: () => Promise<void>;
}

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  signIn: (credentials: LoginRequest) => Promise<void>;
  register: (payload: SignupRequest, options?: RegisterOptions) => Promise<void>;
  signOut: () => Promise<void>;
  /** Clears persisted tokens and local auth state without calling the logout API. */
  endSession: () => Promise<void>;
  /** Removes stored tokens only — keeps status authenticated (e.g. post password-change dialog). */
  clearCredentials: () => Promise<void>;
  /** Drops user/auth status after credentials are already cleared. */
  markUnauthenticated: () => void;
  /** Merge profile fields into the in-memory user after a successful profile save. */
  applyProfileUpdate: (profile: ProfileDetail) => void;
  /** Re-fetch /auth/me so profilePhotoUrl is a freshly signed read URL. */
  refreshUser: () => Promise<void>;
  /** Clears the forced password-change gate after a successful password update. */
  clearMustChangePassword: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);

  const applySession = useCallback((response: AuthResponse) => {
    setAuthToken(response.tokens.accessToken);
    setUser(response.user);
    setStatus('authenticated');
    // Best-effort push registration; never blocks the auth flow.
    void registerDeviceForPush();
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

  const applyProfileUpdate = useCallback((profile: ProfileDetail) => {
    setUser((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        firstName: profile.firstName,
        lastName: profile.lastName,
        mobileNumber: profile.mobileNumber,
        email: profile.email,
        centerId: profile.centerId,
        jerseyNumber: profile.jerseyNumber,
        profilePhotoUrl: profile.profilePhotoUrl,
      };
    });
  }, []);

  const refreshUser = useCallback(async () => {
    const me = await getMe();
    setUser(me);
    setStatus('authenticated');
  }, []);

  const clearMustChangePassword = useCallback(() => {
    setUser((prev) => {
      if (!prev) {
        return prev;
      }
      const { mustChangePassword: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  const signOut = useCallback(async () => {
    await unregisterDeviceForPush();
    try {
      const refreshToken = await loadRefreshToken();
      if (refreshToken) {
        await apiLogout(refreshToken);
      }
    } catch {
      // Best-effort server invalidation; always clear local session.
    }
    await clearRememberMePreferences();
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

  const register = useCallback(async (payload: SignupRequest, options?: RegisterOptions) => {
    const response = await apiSignup(payload);
    await saveTokens(response.tokens);
    // Token only — do not flip status to authenticated yet, or the root
    // navigator redirects to the dashboard before optional hydrate (photo) finishes.
    setAuthToken(response.tokens.accessToken);

    let sessionUser = response.user;
    if (options?.beforeActivate) {
      await options.beforeActivate();
      try {
        sessionUser = await getMe();
      } catch (err) {
        if (__DEV__) {
          console.warn('[auth] signup getMe after beforeActivate failed; using signup user', err);
        }
      }
    }

    setUser(sessionUser);
    setStatus('authenticated');
    void registerDeviceForPush();
  }, []);

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
          void registerDeviceForPush();
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
      applyProfileUpdate,
      refreshUser,
      clearMustChangePassword,
    }),
    [
      status,
      user,
      signIn,
      register,
      signOut,
      clearSession,
      clearCredentials,
      markUnauthenticated,
      applyProfileUpdate,
      refreshUser,
      clearMustChangePassword,
    ],
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
