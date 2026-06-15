import {
  PLACES_RATE_LIMIT,
  type PlaceDetails,
  type PlaceSuggestion,
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
import { ConfigService } from '@nestjs/config';

import { RedisService } from '../redis/redis.service';
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
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
}

interface GoogleGeocodeResponse {
  status?: string;
  results?: Array<{ formatted_address?: string }>;
  error_message?: string;
}

@Injectable()
export class PlacesService {
  private readonly logger = new Logger(PlacesService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  async autocomplete(userId: string, q: string, sessionToken: string): Promise<PlaceSuggestion[]> {
    await this.assertWithinRateLimit(userId);
    const key = this.requireApiKey();

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
    const key = this.requireApiKey();

    const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
    url.searchParams.set('sessionToken', sessionToken);

    const response = await fetch(url.toString(), {
      headers: {
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'formattedAddress,location',
      },
    });

    if (!response.ok) {
      await this.logAndThrowPlacesError('details', response);
    }

    const body = (await response.json()) as GooglePlaceDetailsResponse;
    const address = body.formattedAddress?.trim();
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
    const key = this.requireApiKey();

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

    return { address: body.results[0].formatted_address };
  }

  private requireApiKey(): string {
    let key = this.config.get<string>('GOOGLE_PLACES_KEY')?.trim();
    // Common copy/paste typo: extra leading character before AIzaSy.
    if (key?.startsWith('yAIzaSy')) {
      key = key.slice(1);
    }
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
