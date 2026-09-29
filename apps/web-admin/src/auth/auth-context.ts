import type { AuthUser } from '@acc/types';
import { createContext, useContext } from 'react';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface LoginInput {
  mobileNumber: string;
  password: string;
  rememberMe: boolean;
}

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  /** One-shot message for the login page (session ended, access denied…). */
  notice: string | null;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  clearNotice: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
