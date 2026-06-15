import { Alert, Linking, Platform } from 'react-native';

export interface TournamentVenueLocation {
  locationAddress: string | null;
  latitude: number | null;
  longitude: number | null;
}

export function buildTournamentVenueMapsUrl(venue: TournamentVenueLocation): string | null {
  const address = venue.locationAddress?.trim();
  const hasCoords =
    venue.latitude != null &&
    venue.longitude != null &&
    Number.isFinite(venue.latitude) &&
    Number.isFinite(venue.longitude);

  if (hasCoords) {
    const lat = venue.latitude as number;
    const lng = venue.longitude as number;
    const label = encodeURIComponent(address ?? `${lat},${lng}`);
    if (Platform.OS === 'ios') {
      return `http://maps.apple.com/?ll=${lat},${lng}&q=${label}`;
    }
    return `geo:${lat},${lng}?q=${lat},${lng}(${label})`;
  }

  if (address) {
    const query = encodeURIComponent(address);
    if (Platform.OS === 'ios') {
      return `http://maps.apple.com/?q=${query}`;
    }
    return `geo:0,0?q=${query}`;
  }

  return null;
}

export function tournamentVenueIsOpenable(venue: TournamentVenueLocation): boolean {
  return buildTournamentVenueMapsUrl(venue) != null;
}

/** Opens Apple Maps (iOS) or the system maps chooser (Android) at the saved venue. */
export async function openTournamentVenueInMaps(venue: TournamentVenueLocation): Promise<void> {
  const url = buildTournamentVenueMapsUrl(venue);
  if (!url) {
    Alert.alert('No location', 'This tournament does not have a venue address yet.');
    return;
  }

  try {
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert('Unable to open maps', 'Could not open the maps app for this venue.');
      return;
    }
    await Linking.openURL(url);
  } catch {
    Alert.alert('Unable to open maps', 'Could not open the maps app for this venue.');
  }
}
