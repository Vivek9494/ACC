import { Alert, Linking, Platform } from 'react-native';

export interface OpenableVenueLocation {
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}

/** @deprecated Use {@link OpenableVenueLocation} — tournament detail field names. */
export type TournamentVenueLocation = {
  locationAddress: string | null;
  latitude: number | null;
  longitude: number | null;
};

function hasValidCoordinates(venue: OpenableVenueLocation): boolean {
  return (
    venue.latitude != null &&
    venue.longitude != null &&
    Number.isFinite(venue.latitude) &&
    Number.isFinite(venue.longitude)
  );
}

export function venueLocationIsOpenable(venue: OpenableVenueLocation): boolean {
  return hasValidCoordinates(venue) || Boolean(venue.address?.trim());
}

/** @deprecated Use {@link venueLocationIsOpenable}. */
export function tournamentVenueIsOpenable(venue: TournamentVenueLocation): boolean {
  return venueLocationIsOpenable({
    address: venue.locationAddress,
    latitude: venue.latitude,
    longitude: venue.longitude,
  });
}

export function buildGoogleMapsUrl(venue: OpenableVenueLocation): string | null {
  const address = venue.address?.trim();
  if (hasValidCoordinates(venue)) {
    const lat = venue.latitude as number;
    const lng = venue.longitude as number;
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  if (address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }
  return null;
}

export function buildAppleMapsUrl(venue: OpenableVenueLocation): string | null {
  const address = venue.address?.trim();
  if (hasValidCoordinates(venue)) {
    const lat = venue.latitude as number;
    const lng = venue.longitude as number;
    const label = encodeURIComponent(address ?? `${lat},${lng}`);
    return `http://maps.apple.com/?ll=${lat},${lng}&q=${label}`;
  }
  if (address) {
    return `http://maps.apple.com/?q=${encodeURIComponent(address)}`;
  }
  return null;
}

/** Opens Apple Maps (iOS) or the system maps chooser (Android) at the saved venue. */
export function buildTournamentVenueMapsUrl(venue: TournamentVenueLocation): string | null {
  const openable: OpenableVenueLocation = {
    address: venue.locationAddress,
    latitude: venue.latitude,
    longitude: venue.longitude,
  };
  if (Platform.OS === 'ios') {
    return buildAppleMapsUrl(openable);
  }
  return buildGoogleMapsUrl(openable);
}

async function openMapsUrl(url: string): Promise<void> {
  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) {
    throw new Error('Cannot open maps URL');
  }
  await Linking.openURL(url);
}

/** Native picker: Google Maps + Apple Maps (iOS) for a venue address or coordinates. */
export function promptOpenVenueInMaps(venue: OpenableVenueLocation): void {
  const address = venue.address?.trim() ?? 'Venue location';
  if (!venueLocationIsOpenable(venue)) {
    Alert.alert('No location', 'This match does not have a venue yet.');
    return;
  }

  const googleUrl = buildGoogleMapsUrl(venue);
  const appleUrl = Platform.OS === 'ios' ? buildAppleMapsUrl(venue) : null;

  const buttons: Array<{ text: string; onPress?: () => void; style?: 'cancel' | 'default' }> = [];

  if (googleUrl) {
    buttons.push({
      text: 'Google Maps',
      onPress: () => {
        void openMapsUrl(googleUrl).catch(() => {
          Alert.alert('Unable to open maps', 'Could not open Google Maps for this venue.');
        });
      },
    });
  }

  if (appleUrl) {
    buttons.push({
      text: 'Apple Maps',
      onPress: () => {
        void openMapsUrl(appleUrl).catch(() => {
          Alert.alert('Unable to open maps', 'Could not open Apple Maps for this venue.');
        });
      },
    });
  }

  buttons.push({ text: 'Cancel', style: 'cancel' });

  Alert.alert('Open in Maps', address, buttons);
}

/** @deprecated Use {@link promptOpenVenueInMaps} for the maps-app picker. */
export async function openTournamentVenueInMaps(venue: TournamentVenueLocation): Promise<void> {
  promptOpenVenueInMaps({
    address: venue.locationAddress,
    latitude: venue.latitude,
    longitude: venue.longitude,
  });
}

export function openableVenueFromMatch(
  match: Pick<MatchDetailVenueFields, keyof MatchDetailVenueFields>,
): OpenableVenueLocation {
  return {
    address: match.groundLocation ?? null,
    latitude: match.geofenceLat ?? null,
    longitude: match.geofenceLng ?? null,
  };
}

type MatchDetailVenueFields = {
  groundLocation: string | null;
  geofenceLat: number | null;
  geofenceLng: number | null;
};
