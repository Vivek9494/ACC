import { API_BASE_URL } from './api';

const LOCAL_OVERLAY_ORIGIN = 'http://localhost:5178';
/** Netlify site from apps/scoring-overlay/netlify.toml (`acc-overlay`). */
const PRODUCTION_OVERLAY_ORIGIN = 'https://acc-overlay.netlify.app';

/**
 * Base URL of the broadcast overlay (`apps/scoring-overlay`).
 * Override with `EXPO_PUBLIC_OVERLAY_URL` (no trailing slash).
 * Dev defaults to local Vite; non-dev defaults to the deployed Netlify host.
 */
export function resolveOverlayOrigin(): string {
  const configured = process.env.EXPO_PUBLIC_OVERLAY_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    return LOCAL_OVERLAY_ORIGIN;
  }
  return PRODUCTION_OVERLAY_ORIGIN;
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
