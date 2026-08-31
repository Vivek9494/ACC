const LOCAL_OVERLAY_ORIGIN = 'http://localhost:5178';
/** Netlify site from apps/scoring-overlay/netlify.toml (`acc-overlay`). */
const PRODUCTION_OVERLAY_ORIGIN = 'https://acc-overlay.netlify.app';

function configuredOverlayOrigin(): string | null {
  const configured = process.env.EXPO_PUBLIC_OVERLAY_URL?.trim();
  return configured ? configured.replace(/\/$/, '') : null;
}

/**
 * Deployed overlay host — single source of truth for OBS browser source links
 * and cockpit scoreboard embeds.
 */
export function resolveDeployedOverlayOrigin(): string {
  return configuredOverlayOrigin() ?? PRODUCTION_OVERLAY_ORIGIN;
}

function buildOverlayPageUrl(origin: string, matchId: string): string {
  const params = new URLSearchParams({ matchId });
  return `${origin}/?${params.toString()}`;
}

/** OBS browser source URL — deployed overlay host only (never localhost). */
export function overlayObsBrowserSourceUrl(matchId: string): string {
  return buildOverlayPageUrl(resolveDeployedOverlayOrigin(), matchId);
}

/** Cockpit Main Scoreboard iframe — same `/?matchId=` URL as the OBS overlay link. */
export function overlayScoreboardUrl(matchId: string): string {
  return overlayObsBrowserSourceUrl(matchId);
}

/** Dev-only: log resolved overlay embed URL and config source. */
export function logOverlayEmbedResolution(matchId: string, src: string): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return;
  }
  const configured = configuredOverlayOrigin();
  console.info('[ACC overlay] scoreboard embed', {
    matchId,
    src,
    origin: resolveDeployedOverlayOrigin(),
    configKey: 'EXPO_PUBLIC_OVERLAY_URL',
    configured: configured ?? '(unset — using production default)',
    localDevFallback: LOCAL_OVERLAY_ORIGIN,
  });
}
