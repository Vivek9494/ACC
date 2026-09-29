import { AuthErrorCode, type AuthTokens } from '@acc/types';

const API_BASE = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '');
const REFRESH_TOKEN_KEY = 'acc-admin.refreshToken';

export class ApiError extends Error {
  /** Every message the api returned (validation errors arrive as a list). */
  readonly messages: readonly string[];

  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    messages?: readonly string[],
    /** Per-field validation messages (e.g. tournament form), keyed by form field. */
    readonly fields: Readonly<Record<string, string>> = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.messages = messages ?? [message];
  }
}

/** User-facing message for any thrown value. */
export function errorMessage(
  err: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/**
 * Access token lives in memory only. The refresh token is kept in
 * localStorage ("Remember me") or sessionStorage (cleared with the tab).
 */
let accessToken: string | null = null;
let sessionEndedListener: (() => void) | null = null;
let refreshInFlight: Promise<boolean> | null = null;

function storageHolding(key: string): Storage | null {
  if (localStorage.getItem(key) !== null) return localStorage;
  if (sessionStorage.getItem(key) !== null) return sessionStorage;
  return null;
}

export const tokenStore = {
  getRefreshToken(): string | null {
    return storageHolding(REFRESH_TOKEN_KEY)?.getItem(REFRESH_TOKEN_KEY) ?? null;
  },
  hasAccessToken(): boolean {
    return accessToken !== null;
  },
  /** `remember` undefined keeps the storage the current refresh token lives in. */
  set(tokens: AuthTokens, remember?: boolean): void {
    const current = storageHolding(REFRESH_TOKEN_KEY);
    const target =
      remember === undefined
        ? (current ?? sessionStorage)
        : remember
          ? localStorage
          : sessionStorage;
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    target.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
    accessToken = tokens.accessToken;
  },
  clear(): void {
    accessToken = null;
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

/** Called when a refresh fails mid-session (expired, or signed in on another device). */
export function onSessionEnded(listener: (() => void) | null): void {
  sessionEndedListener = listener;
}

function isEnvelope(value: unknown): value is { data: unknown; error: unknown } {
  return typeof value === 'object' && value !== null && 'data' in value && 'error' in value;
}

/** Errors arrive in the API envelope: `{ data: null, error: { code, message } }`. */
async function toApiError(res: Response): Promise<ApiError> {
  let messages: string[] = [`Request failed (${res.status})`];
  let code: string | undefined;
  const fields: Record<string, string> = {};
  try {
    const body: unknown = await res.json();
    const error = isEnvelope(body) ? body.error : body;
    if (error && typeof error === 'object') {
      const raw = 'message' in error ? error.message : undefined;
      if (typeof raw === 'string') messages = [raw];
      else if (Array.isArray(raw) && raw.length > 0 && raw.every((m) => typeof m === 'string')) {
        messages = raw;
      }
      if ('code' in error && typeof error.code === 'string') code = error.code;
      if ('fields' in error && error.fields && typeof error.fields === 'object') {
        for (const [key, value] of Object.entries(error.fields)) {
          if (typeof value === 'string') fields[key] = value;
        }
      }
    }
  } catch {
    // Non-JSON error body — keep the generic message.
  }
  return new ApiError(res.status, messages.join(', '), code, messages, fields);
}

/** 401s that reject a submitted credential (not the session) — never refresh or sign out on these. */
const CREDENTIAL_ERROR_CODES: ReadonlySet<string> = new Set([
  AuthErrorCode.CurrentPasswordIncorrect,
]);

/** Single-flight refresh; resolves false (and clears tokens) when the session is gone. */
export function refreshSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  const refreshToken = tokenStore.getRefreshToken();
  if (!refreshToken) return Promise.resolve(false);

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        tokenStore.clear();
        return false;
      }
      const tokens: AuthTokens = await res.json();
      tokenStore.set(tokens);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Attach the bearer token and refresh once on 401 (default true). */
  auth?: boolean;
  signal?: AbortSignal;
}

async function request(
  path: string,
  options: RequestOptions,
  allowRetry: boolean,
): Promise<Response> {
  const { method = 'GET', body, auth = true, signal } = options;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

  if (res.status === 401 && auth && allowRetry) {
    const error = await toApiError(res.clone());
    if (error.code && CREDENTIAL_ERROR_CODES.has(error.code)) throw error;
    if (await refreshSession()) return request(path, options, false);
    tokenStore.clear();
    sessionEndedListener?.();
    throw new ApiError(401, 'Your session has ended. Please sign in again.', 'SESSION_ENDED');
  }
  if (!res.ok) throw await toApiError(res);
  return res;
}

/** JSON request — the typed boundary between the API and the dashboard. */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await request(path, options, true);
  const data: T = await res.json();
  return data;
}

/** JSON request for endpoints that return `null` — Nest sends an empty body for it. */
export async function apiFetchOptional<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T | null> {
  const res = await request(path, options, true);
  const text = await res.text();
  if (text.length === 0) return null;
  const data: T | null = JSON.parse(text);
  return data;
}

/** Request with no response body (e.g. 204). */
export async function apiSend(path: string, options: RequestOptions = {}): Promise<void> {
  await request(path, options, true);
}
