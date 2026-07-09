import { NodeEnv } from './env.validation';

/** `true` reflects the request Origin (dev); a string[] is an explicit allowlist (prod). */
export type CorsOriginSetting = boolean | string[];

/**
 * Resolves HTTP and Socket.IO CORS origins from env.
 * Development/test: reflect any origin (Expo Go on LAN).
 * Production: comma-separated allowlist from {@link CORS_ORIGINS}.
 */
export function resolveCorsOrigins(
  nodeEnv: NodeEnv,
  corsOriginsRaw: string | undefined,
): CorsOriginSetting {
  if (nodeEnv !== NodeEnv.Production) {
    return true;
  }

  return (corsOriginsRaw ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}
