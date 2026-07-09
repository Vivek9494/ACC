/**
 * Resolves the API base URL for REST and Socket.IO clients.
 * Production builds must set EXPO_PUBLIC_API_URL at build time (EAS env/secrets).
 */
export function resolveApiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }

  if (__DEV__) {
    return 'http://localhost:3001';
  }

  throw new Error(
    'EXPO_PUBLIC_API_URL is not set. Configure it in eas.json or EAS secrets before a production build.',
  );
}

export const API_BASE_URL = resolveApiBaseUrl();
