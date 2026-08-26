import { API_BASE_URL } from './api';

const DEFAULT_OVERLAY_ORIGIN = 'http://localhost:5178';

/**
 * Base URL of the broadcast overlay (`apps/scoring-overlay`).
 * Override with `EXPO_PUBLIC_OVERLAY_URL` (no trailing slash).
 */
export function resolveOverlayOrigin(): string {
  const configured = process.env.EXPO_PUBLIC_OVERLAY_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }
  return DEFAULT_OVERLAY_ORIGIN;
}

/** Overlay score-strip page bound to this match (same `/live` feed as mobile). */
export function overlayScoreboardUrl(matchId: string): string {
  const origin = resolveOverlayOrigin();
  const params = new URLSearchParams({
    matchId,
    api: API_BASE_URL,
  });
  return `${origin}/?${params.toString()}`;
}
