import {
  isAllowedGoogleMapsHost,
  normalizeMapsUrlInput,
} from '@acc/types';

const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 8000;

/** Follows Google Maps short-link redirects; returns the final URL string. */
export async function followGoogleMapsRedirects(urlInput: string): Promise<string> {
  let current = normalizeMapsUrlInput(urlInput);
  if (!isAllowedGoogleMapsHost(current.hostname)) {
    throw new Error('URL host is not an allowed Google Maps domain');
  }

  for (let step = 0; step < MAX_REDIRECTS; step += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(current.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent': 'ACC-Places-Resolver/1.0',
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          return current.toString();
        }
        current = new URL(location, current);
        if (!isAllowedGoogleMapsHost(current.hostname)) {
          throw new Error('Redirect left allowed Google Maps domains');
        }
        continue;
      }

      return current.toString();
    } finally {
      clearTimeout(timeout);
    }
  }

  return current.toString();
}
