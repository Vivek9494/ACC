import { ApiRequestError, isSessionExpiredError } from './api';

/**
 * Maps a fetch failure to a user-visible message, or null when the session
 * expired and the shared client already routed to Login.
 */
export function dashboardFetchError(
  err: unknown,
  fallback = 'Could not load dashboard. Check your connection.',
): string | null {
  if (isSessionExpiredError(err)) {
    return null;
  }
  if (err instanceof ApiRequestError) {
    return err.message;
  }
  return fallback;
}

/** Logs fetch failures unless the session was cleared for re-login. */
export function logFetchError(context: string, err: unknown): void {
  if (isSessionExpiredError(err)) {
    return;
  }
  console.error(context, err);
}
