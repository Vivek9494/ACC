/** Ground / venue location field — coordinate and Google Maps link parsing. */

export const LOCATION_INPUT_MESSAGES = {
  invalidCoordinates: 'Enter latitude and longitude between -90…90 and -180…180.',
  mapsLinkFailed: "Couldn't read that location link.",
  resolvingLink: 'Resolving location link…',
  resolvingCoordinates: 'Looking up address for coordinates…',
} as const;

const COORD_PAIR_RE = /^\s*([+-]?\d+(?:\.\d+)?)\s*[,\s]\s*([+-]?\d+(?:\.\d+)?)\s*$/;

const MAPS_AT_COORDS_RE = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/;
const MAPS_QUERY_COORDS_RE = /[?&]q=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/;
const MAPS_LL_COORDS_RE = /[?&]ll=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/;
const MAPS_PLACE_PATH_RE = /\/maps\/place\/([^/@?]+)/;

const ALLOWED_MAPS_HOSTS = new Set([
  'maps.app.goo.gl',
  'goo.gl',
  'google.com',
  'www.google.com',
  'maps.google.com',
  'www.google.ca',
  'google.ca',
  'maps.google.ca',
]);

function parseCoordNumbers(latStr: string, lngStr: string): { latitude: number; longitude: number } | null {
  const latitude = Number(latStr);
  const longitude = Number(lngStr);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  return { latitude, longitude };
}

function isValidCoordinateRange(latitude: number, longitude: number): boolean {
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

/** Parses a decimal-degree coordinate pair from plain text (comma or space separated). */
export function parseCoordinatePairRaw(
  input: string,
): { latitude: number; longitude: number } | null {
  const match = COORD_PAIR_RE.exec(input.trim());
  if (!match) {
    return null;
  }
  const latStr = match[1];
  const lngStr = match[2];
  if (latStr == null || lngStr == null) {
    return null;
  }
  return parseCoordNumbers(latStr, lngStr);
}

/** Parses and validates a coordinate pair; null when malformed or out of range. */
export function parseCoordinatePair(
  input: string,
): { latitude: number; longitude: number } | null {
  const raw = parseCoordinatePairRaw(input);
  if (!raw || !isValidCoordinateRange(raw.latitude, raw.longitude)) {
    return null;
  }
  return raw;
}

export function isCoordinateLikeInput(input: string): boolean {
  return parseCoordinatePairRaw(input.trim()) !== null;
}

export function isGoogleMapsShortLink(input: string): boolean {
  try {
    const url = normalizeMapsUrlInput(input);
    const host = url.hostname.toLowerCase();
    return host === 'maps.app.goo.gl' || (host === 'goo.gl' && url.pathname.startsWith('/maps'));
  } catch {
    return false;
  }
}

/** Normalizes user paste into a URL (adds https when omitted). */
export function normalizeMapsUrlInput(input: string): URL {
  const trimmed = input.trim();
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return new URL(withScheme);
}

export function isAllowedGoogleMapsHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (ALLOWED_MAPS_HOSTS.has(host)) {
    return true;
  }
  return host.endsWith('.google.com') || host.endsWith('.google.ca');
}

/** True when input looks like a Google Maps share / maps URL. */
export function looksLikeGoogleMapsUrl(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed.includes('.') && !trimmed.startsWith('http')) {
    return false;
  }
  try {
    const url = normalizeMapsUrlInput(trimmed);
    return isAllowedGoogleMapsHost(url.hostname);
  } catch {
    return false;
  }
}

function coordsFromMapsUrl(url: URL): { latitude: number; longitude: number } | null {
  const atMatch = MAPS_AT_COORDS_RE.exec(url.href);
  if (atMatch) {
    const latStr = atMatch[1];
    const lngStr = atMatch[2];
    if (latStr != null && lngStr != null) {
      const parsed = parseCoordNumbers(latStr, lngStr);
      if (parsed && isValidCoordinateRange(parsed.latitude, parsed.longitude)) {
        return parsed;
      }
    }
  }

  for (const re of [MAPS_QUERY_COORDS_RE, MAPS_LL_COORDS_RE]) {
    const match = re.exec(url.href);
    if (match) {
      const latStr = match[1];
      const lngStr = match[2];
      if (latStr != null && lngStr != null) {
        const parsed = parseCoordNumbers(latStr, lngStr);
        if (parsed && isValidCoordinateRange(parsed.latitude, parsed.longitude)) {
          return parsed;
        }
      }
    }
  }

  return null;
}

/** Extracts coordinates embedded in a Google Maps URL (no redirect follow). */
export function parseGoogleMapsUrlCoordinates(
  input: string,
): { latitude: number; longitude: number } | null {
  try {
    const url = normalizeMapsUrlInput(input);
    if (!isAllowedGoogleMapsHost(url.hostname)) {
      return null;
    }
    return coordsFromMapsUrl(url);
  } catch {
    return null;
  }
}

/** Place name query from a /maps/place/… URL or non-numeric ?q= parameter. */
export function extractGoogleMapsPlaceQuery(input: string): string | null {
  try {
    const url = normalizeMapsUrlInput(input);
    const pathMatch = MAPS_PLACE_PATH_RE.exec(url.pathname);
    if (pathMatch?.[1]) {
      const decoded = decodeURIComponent(pathMatch[1].replace(/\+/g, ' ')).trim();
      if (decoded.length > 0) {
        return decoded;
      }
    }

    const q = url.searchParams.get('q')?.trim();
    if (q && !/^[-+]?\d+(?:\.\d+)?,\s*[-+]?\d+(?:\.\d+)?$/.test(q)) {
      return q;
    }
  } catch {
    return null;
  }
  return null;
}
