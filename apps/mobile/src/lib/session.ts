import type { AuthTokens } from '@acc/types';

import { deleteSecureItem, getSecureItem, setSecureItem } from './secure-storage';

/**
 * Token persistence — SecureStore on native, localStorage on web (auth v1).
 */

const ACCESS_TOKEN_KEY = 'acc.accessToken';
const REFRESH_TOKEN_KEY = 'acc.refreshToken';

export async function loadAccessToken(): Promise<string | null> {
  return getSecureItem(ACCESS_TOKEN_KEY);
}

export async function saveTokens(tokens: AuthTokens): Promise<void> {
  await Promise.all([
    setSecureItem(ACCESS_TOKEN_KEY, tokens.accessToken),
    setSecureItem(REFRESH_TOKEN_KEY, tokens.refreshToken),
  ]);
}

export async function loadTokens(): Promise<AuthTokens | null> {
  const [accessToken, refreshToken] = await Promise.all([
    getSecureItem(ACCESS_TOKEN_KEY),
    getSecureItem(REFRESH_TOKEN_KEY),
  ]);
  if (!accessToken || !refreshToken) {
    return null;
  }
  return { accessToken, refreshToken };
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    deleteSecureItem(ACCESS_TOKEN_KEY),
    deleteSecureItem(REFRESH_TOKEN_KEY),
  ]);
}
