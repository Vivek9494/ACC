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

export interface ReverseGeocodeResult {
  address: string;
}
