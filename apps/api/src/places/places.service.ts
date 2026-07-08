import {
  LOCATION_INPUT_MESSAGES,
  PLACES_RATE_LIMIT,
  extractGoogleMapsPlaceQuery,
  formatPlaceDisplayAddress,
  isAllowedGoogleMapsHost,
  isGoogleMapsShortLink,
  normalizeMapsUrlInput,
  parseGoogleMapsUrlCoordinates,
  type PlaceDetails,
  type PlaceSuggestion,
  type ResolvedLocationResult,
  type ReverseGeocodeResult,
} from '@acc/types';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

import { RedisService } from '../redis/redis.service';
import { AppSettingsService } from '../settings/app-settings.service';
import { followGoogleMapsRedirects } from './maps-link.utils';
import { placesRateLimitKey } from './places.constants';

interface GoogleAutocompleteResponse {
  suggestions?: Array<{
    placePrediction?: {
      place?: string;
      placeId?: string;
      text?: { text?: string };
    };
  }>;
}

interface GooglePlaceDetailsResponse {
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
}

interface GoogleGeocodeResponse {
  status?: string;
  results?: Array<{
    formatted_address?: string;
    geometry?: { location?: { lat?: number; lng?: number } };
  }>;
  error_message?: string;
}

@Injectable()
export class PlacesService {
  private readonly logger = new Logger(PlacesService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly settings: AppSettingsService,
  ) {}

  async autocomplete(userId: string, q: string, sessionToken: string): Promise<PlaceSuggestion[]> {
    await this.assertWithinRateLimit(userId);
    const key = await this.requireApiKey();

    const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
      },
      body: JSON.stringify({
        input: q,
        sessionToken,
        includedRegionCodes: ['ca'],
      }),
    });

    if (!response.ok) {
      await this.logAndThrowPlacesError('autocomplete', response);
    }

    const body = (await response.json()) as GoogleAutocompleteResponse;
    const suggestions: PlaceSuggestion[] = [];

    for (const item of body.suggestions ?? []) {
      const prediction = item.placePrediction;
      const placeId = extractPlaceId(prediction);
      const description = prediction?.text?.text;
      if (placeId && description) {
        suggestions.push({ placeId, description });
      }
    }

    return suggestions;
  }

  async details(
    userId: string,
    placeId: string,
    sessionToken: string,
  ): Promise<PlaceDetails> {
    await this.assertWithinRateLimit(userId);
    const key = await this.requireApiKey();

    const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
    url.searchParams.set('sessionToken', sessionToken);

    const response = await fetch(url.toString(), {
      headers: {
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'displayName,formattedAddress,location',
      },
    });

    if (!response.ok) {
      await this.logAndThrowPlacesError('details', response);
    }

    const body = (await response.json()) as GooglePlaceDetailsResponse;
    const address = formatPlaceDisplayAddress(
      body.displayName?.text,
      body.formattedAddress,
    );
    const latitude = body.location?.latitude;
    const longitude = body.location?.longitude;

    if (!address || latitude == null || longitude == null) {
      throw new BadRequestException({
        message: 'Place details are incomplete',
        error: 'PLACES_DETAILS_INCOMPLETE',
      });
    }

    return { address, latitude, longitude };
  }

  async reverse(userId: string, latitude: number, longitude: number): Promise<ReverseGeocodeResult> {
    await this.assertWithinRateLimit(userId);
    const address = await this.reverseGeocodeAddress(latitude, longitude);
    return { address };
  }

  async resolveMapsLink(userId: string, urlInput: string): Promise<ResolvedLocationResult> {
    await this.assertWithinRateLimit(userId);

    let normalized: URL;
    try {
      normalized = normalizeMapsUrlInput(urlInput);
    } catch {
      throw new BadRequestException({
        message: LOCATION_INPUT_MESSAGES.mapsLinkFailed,
        error: 'MAPS_LINK_UNRESOLVED',
      });
    }

    if (!isAllowedGoogleMapsHost(normalized.hostname)) {
      throw new BadRequestException({
        message: LOCATION_INPUT_MESSAGES.mapsLinkFailed,
        error: 'MAPS_LINK_UNRESOLVED',
      });
    }

    let targetUrl = normalized.toString();
    if (isGoogleMapsShortLink(urlInput)) {
      try {
        targetUrl = await followGoogleMapsRedirects(urlInput);
        this.logger.log(`Expanded Google Maps short link (${normalized.hostname})`);
      } catch (err) {
        this.logger.warn(
          `Maps short-link redirect failed (${normalized.hostname}): ${(err as Error).message}`,
        );
        throw new BadRequestException({
          message: LOCATION_INPUT_MESSAGES.mapsLinkFailed,
          error: 'MAPS_LINK_UNRESOLVED',
        });
      }
    }

    const coords = parseGoogleMapsUrlCoordinates(targetUrl);
    if (coords) {
      const address = await this.reverseGeocodeAddress(coords.latitude, coords.longitude);
      return { address, latitude: coords.latitude, longitude: coords.longitude };
    }

    const placeQuery = extractGoogleMapsPlaceQuery(targetUrl);
    if (placeQuery) {
      return this.forwardGeocode(placeQuery);
    }

    throw new BadRequestException({
      message: LOCATION_INPUT_MESSAGES.mapsLinkFailed,
      error: 'MAPS_LINK_UNRESOLVED',
    });
  }

  private async reverseGeocodeAddress(latitude: number, longitude: number): Promise<string> {
    const key = await this.requireApiKey();

    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('latlng', `${latitude},${longitude}`);
    url.searchParams.set('key', key);

    const response = await fetch(url.toString());
    if (!response.ok) {
      await this.logAndThrowPlacesError('reverse', response);
    }

    const body = (await response.json()) as GoogleGeocodeResponse;
    if (body.status !== 'OK' || !body.results?.[0]?.formatted_address) {
      this.logger.warn(
        `Geocode reverse failed: status=${body.status ?? 'unknown'} ${body.error_message ?? ''}`,
      );
      throw new BadRequestException({
        message: 'Could not resolve address for this location',
        error: 'PLACES_REVERSE_FAILED',
      });
    }

    return body.results[0].formatted_address;
  }

  private async forwardGeocode(query: string): Promise<ResolvedLocationResult> {
    const key = await this.requireApiKey();

    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', query);
    url.searchParams.set('components', 'country:CA');
    url.searchParams.set('key', key);

    const response = await fetch(url.toString());
    if (!response.ok) {
      await this.logAndThrowPlacesError('forward', response);
    }

    const body = (await response.json()) as GoogleGeocodeResponse;
    const result = body.results?.[0];
    const address = result?.formatted_address?.trim();
    const latitude = result?.geometry?.location?.lat;
    const longitude = result?.geometry?.location?.lng;

    if (body.status !== 'OK' || !address || latitude == null || longitude == null) {
      this.logger.warn(
        `Geocode forward failed: status=${body.status ?? 'unknown'} ${body.error_message ?? ''}`,
      );
      throw new BadRequestException({
        message: LOCATION_INPUT_MESSAGES.mapsLinkFailed,
        error: 'MAPS_LINK_UNRESOLVED',
      });
    }

    return { address, latitude, longitude };
  }

  private async requireApiKey(): Promise<string> {
    const key = await this.settings.getGoogleMapsApiKey();
    if (!key) {
      throw new ServiceUnavailableException({
        message: 'Location search is not configured',
        error: 'PLACES_UNAVAILABLE',
      });
    }
    return key;
  }

  private async assertWithinRateLimit(userId: string): Promise<void> {
    const count = await this.redis.incrementWithTtl(
      placesRateLimitKey(userId),
      PLACES_RATE_LIMIT.windowSeconds,
    );
    if (count > PLACES_RATE_LIMIT.maxRequests) {
      throw new HttpException(
        {
          message: 'Too many location search requests. Please wait a moment.',
          error: 'PLACES_RATE_LIMIT',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async logAndThrowPlacesError(
    operation: string,
    response: Response,
  ): Promise<never> {
    const text = await response.text();
    this.logger.warn(`Google Places ${operation} failed: ${response.status} ${text}`);
    throw new BadRequestException({
      message: 'Could not complete the location search',
      error: 'PLACES_REQUEST_FAILED',
    });
  }
}

function extractPlaceId(prediction?: {
  placeId?: string;
  place?: string;
}): string | undefined {
  if (!prediction) {
    return undefined;
  }
  if (prediction.placeId) {
    return prediction.placeId;
  }
  const resource = prediction.place;
  if (resource?.startsWith('places/')) {
    return resource.slice('places/'.length);
  }
  return resource;
}
