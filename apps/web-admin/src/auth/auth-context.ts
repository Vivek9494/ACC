import type { AuthUser } from '@acc/types';
import { createContext, useContext } from 'react';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export type NoticeTone = 'error' | 'success';

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
  noticeTone: NoticeTone;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  /** Drop the local session the server already invalidated (password changed) and show a success notice. */
  endSession: (notice: string) => void;
  clearNotice: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
