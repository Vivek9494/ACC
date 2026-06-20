import { isValidIanaTimezone } from '@acc/types';
import { find as findTimezone } from 'geo-tz';

/** Resolves an IANA timezone from map coordinates (once at tournament create/edit). */
export function resolveTimezoneFromCoordinates(
  latitude: number,
  longitude: number,
): string | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  const zones = findTimezone(latitude, longitude);
  const zone = zones[0];
  if (!zone || !isValidIanaTimezone(zone)) {
    return null;
  }
  return zone;
}

export function resolveTournamentTimezone(input: {
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string | null;
  existingTimezone?: string | null;
}): string | null {
  if (input.timezone !== undefined) {
    const explicit = input.timezone?.trim();
    if (!explicit) {
      return null;
    }
    if (!isValidIanaTimezone(explicit)) {
      return input.existingTimezone ?? null;
    }
    return explicit;
  }

  if (input.latitude != null && input.longitude != null) {
    return resolveTimezoneFromCoordinates(input.latitude, input.longitude);
  }

  return input.existingTimezone ?? null;
}
