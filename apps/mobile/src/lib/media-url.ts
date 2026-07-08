import { isMediaStorageKey } from '@acc/types';

import { API_BASE_URL } from './api';

/**
 * Dev uploads use PUBLIC_API_URL (often localhost). Rewrite to EXPO_PUBLIC_API_URL so
 * physical devices on the LAN load the same path from the reachable API host.
 */
export function resolveMediaDisplayUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) {
    return null;
  }
  if (isMediaStorageKey(trimmed)) {
    if (__DEV__) {
      console.warn(
        '[media-url] raw S3 storage key passed to Image — API must return a presigned read URL:',
        trimmed,
      );
    }
    return null;
  }
  if (trimmed.startsWith('/')) {
    try {
      return new URL(trimmed, API_BASE_URL).toString();
    } catch {
      return trimmed;
    }
  }
  try {
    const media = new URL(trimmed);
    if (media.hostname !== 'localhost' && media.hostname !== '127.0.0.1') {
      return trimmed;
    }
    const api = new URL(API_BASE_URL);
    media.protocol = api.protocol;
    media.hostname = api.hostname;
    media.port = api.port;
    return media.toString();
  } catch {
    return trimmed;
  }
}
