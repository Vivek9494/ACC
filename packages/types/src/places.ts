/** Google Places proxy contracts (server-side key; mobile calls /places/*). */

export const PLACES_RATE_LIMIT = {
  /** Max autocomplete/details/reverse requests per user per window. */
  maxRequests: 60,
  windowSeconds: 60,
} as const;

export interface PlaceSuggestion {
  placeId: string;
  description: string;
}

export interface PlaceDetails {
  address: string;
  latitude: number;
  longitude: number;
}

/** Build a human-readable venue line from Places display name + formatted address. */
export function formatPlaceDisplayAddress(
  displayName: string | undefined,
  formattedAddress: string | undefined,
): string | undefined {
  const name = displayName?.trim();
  const formatted = formattedAddress?.trim();
  if (name && formatted) {
    if (formatted.toLowerCase().startsWith(name.toLowerCase())) {
      return formatted;
    }
    return `${name}, ${formatted}`;
  }
  return name ?? formatted;
}

export interface ReverseGeocodeResult {
  address: string;
}

/** Resolved venue from coordinates or a Google Maps link. */
export interface ResolvedLocationResult {
  address: string;
  latitude: number;
  longitude: number;
}
