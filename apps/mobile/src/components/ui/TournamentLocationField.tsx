import { Ionicons } from '@expo/vector-icons';
import {
  LOCATION_INPUT_MESSAGES,
  isCoordinateLikeInput,
  looksLikeGoogleMapsUrl,
  normalizeMapsUrlInput,
  parseCoordinatePair,
  parseGoogleMapsUrlCoordinates,
  type PlaceSuggestion,
} from '@acc/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import {
  ApiRequestError,
  placesAutocomplete,
  placesDetails,
  placesResolveMapsLink,
  placesReverse,
} from '../../lib/api';
import { createPlacesSessionToken } from '../../lib/places-session';
import { FIELD_ORANGE, INPUT_SHADOW_STYLE } from './fieldStyles';
import { FormErrorText } from './FormErrorText';
import {
  DEFAULT_MAP_REGION,
  regionForCoordinate,
  type MapRegion,
} from './map-region';
import { Text } from './Text';
import { TextInput } from './TextInput';
import {
  TournamentLocationMap,
  type TournamentLocationMapHandle,
} from './TournamentLocationMap';

const AUTOCOMPLETE_DEBOUNCE_MS = 350;
const REVERSE_GEOCODE_DEBOUNCE_MS = 400;

type LocationSuggestion =
  | ({ kind: 'place' } & PlaceSuggestion)
  | {
      kind: 'resolved';
      latitude: number;
      longitude: number;
      description: string;
    };

function suggestionKey(item: LocationSuggestion): string {
  if (item.kind === 'place') {
    return item.placeId;
  }
  return `resolved:${item.latitude},${item.longitude}`;
}

function placesSearchErrorMessage(err: unknown): string {
  if (err instanceof ApiRequestError) {
    if (err.error.code === 'PLACES_UNAVAILABLE') {
      return 'Location search is not configured on the server.';
    }
    if (err.error.code === 'PLACES_RATE_LIMIT') {
      return 'Too many searches. Wait a moment and try again.';
    }
    if (err.error.code === 'MAPS_LINK_UNRESOLVED') {
      return LOCATION_INPUT_MESSAGES.mapsLinkFailed;
    }
    const message = Array.isArray(err.error.message)
      ? err.error.message.join(', ')
      : err.error.message;
    if (message) {
      return message;
    }
  }
  return 'Could not search locations. Check your connection and try again.';
}

export interface TournamentLocationFieldProps {
  address: string;
  latitude: number | null;
  longitude: number | null;
  onAddressChange: (address: string) => void;
  onCoordinatesChange: (latitude: number | null, longitude: number | null) => void;
  onLayout?: (event: LayoutChangeEvent) => void;
  label?: string;
}

export function TournamentLocationField({
  address,
  latitude,
  longitude,
  onAddressChange,
  onCoordinatesChange,
  onLayout,
  label = 'Tournament Location',
}: TournamentLocationFieldProps): React.ReactElement {
  const sessionTokenRef = useRef(createPlacesSessionToken());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reverseDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipAutocompleteRef = useRef(false);
  const mapRef = useRef<TournamentLocationMapHandle>(null);
  const mapRegionRef = useRef<MapRegion>(DEFAULT_MAP_REGION);

  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [previewCoords, setPreviewCoords] = useState<{ latitude: number; longitude: number } | null>(
    null,
  );
  const [searching, setSearching] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [updatingAddress, setUpdatingAddress] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchStatus, setSearchStatus] = useState<string | null>(null);

  const hasCoordinates = latitude != null && longitude != null;
  const displayLatitude = latitude ?? previewCoords?.latitude ?? null;
  const displayLongitude = longitude ?? previewCoords?.longitude ?? null;
  const hasMapPreview = displayLatitude != null && displayLongitude != null;
  const isPreviewOnly = !hasCoordinates && previewCoords != null;
  const trimmedAddress = address.trim();
  const showEmptyState =
    showSuggestions &&
    !searching &&
    !searchError &&
    trimmedAddress.length >= 2 &&
    suggestions.length === 0 &&
    !looksLikeGoogleMapsUrl(trimmedAddress) &&
    !isCoordinateLikeInput(trimmedAddress);

  const initialMapRegion = hasMapPreview
    ? regionForCoordinate(displayLatitude, displayLongitude)
    : DEFAULT_MAP_REGION;

  useEffect(() => {
    if (hasMapPreview && displayLatitude != null && displayLongitude != null) {
      mapRegionRef.current = regionForCoordinate(displayLatitude, displayLongitude);
    }
  }, [hasMapPreview, displayLatitude, displayLongitude]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (reverseDebounceRef.current) {
        clearTimeout(reverseDebounceRef.current);
      }
    };
  }, []);

  const recenterMap = useCallback((lat: number, lng: number) => {
    const next = regionForCoordinate(lat, lng);
    mapRegionRef.current = next;
    mapRef.current?.animateToRegion(next, 300);
  }, []);

  const showResolvedSuggestion = useCallback(
    (resolved: { latitude: number; longitude: number; description: string }) => {
      setPreviewCoords({ latitude: resolved.latitude, longitude: resolved.longitude });
      setSuggestions([
        {
          kind: 'resolved',
          latitude: resolved.latitude,
          longitude: resolved.longitude,
          description: resolved.description,
        },
      ]);
      setShowSuggestions(true);
      recenterMap(resolved.latitude, resolved.longitude);
    },
    [recenterMap],
  );

  const runAutocomplete = useCallback(async (query: string, token: string) => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setSearchError(null);
      setShowSuggestions(false);
      setSearching(false);
      setSearchStatus(null);
      return;
    }

    setSearching(true);
    setSearchError(null);
    setSearchStatus('Searching locations…');
    try {
      const results = await placesAutocomplete(trimmed, token);
      setPreviewCoords(null);
      setSuggestions(results.map((item) => ({ kind: 'place', ...item })));
      setShowSuggestions(true);
    } catch (err) {
      setSuggestions([]);
      setShowSuggestions(true);
      setSearchError(placesSearchErrorMessage(err));
    } finally {
      setSearching(false);
      setSearchStatus(null);
    }
  }, []);

  const resolveCoordinateInput = useCallback(
    async (query: string) => {
      const trimmed = query.trim();
      if (!isCoordinateLikeInput(trimmed)) {
        return false;
      }

      const coords = parseCoordinatePair(trimmed);
      if (!coords) {
        setSuggestions([]);
        setPreviewCoords(null);
        setShowSuggestions(true);
        setSearchError(LOCATION_INPUT_MESSAGES.invalidCoordinates);
        return true;
      }

      setSearching(true);
      setSearchError(null);
      setSearchStatus(LOCATION_INPUT_MESSAGES.resolvingCoordinates);
      try {
        const result = await placesReverse(coords.latitude, coords.longitude);
        showResolvedSuggestion({
          latitude: coords.latitude,
          longitude: coords.longitude,
          description: result.address,
        });
      } catch (err) {
        setSuggestions([]);
        setPreviewCoords(null);
        setShowSuggestions(true);
        setSearchError(placesSearchErrorMessage(err));
      } finally {
        setSearching(false);
        setSearchStatus(null);
      }
      return true;
    },
    [showResolvedSuggestion],
  );

  const resolveMapsLinkInput = useCallback(
    async (query: string) => {
      const trimmed = query.trim();
      if (!looksLikeGoogleMapsUrl(trimmed)) {
        return false;
      }

      setSearching(true);
      setSearchError(null);
      setSearchStatus(LOCATION_INPUT_MESSAGES.resolvingLink);
      try {
        const embeddedCoords = parseGoogleMapsUrlCoordinates(trimmed);
        if (embeddedCoords) {
          const result = await placesReverse(embeddedCoords.latitude, embeddedCoords.longitude);
          showResolvedSuggestion({
            latitude: embeddedCoords.latitude,
            longitude: embeddedCoords.longitude,
            description: result.address,
          });
          return true;
        }

        const normalizedUrl = normalizeMapsUrlInput(trimmed).toString();
        const result = await placesResolveMapsLink(normalizedUrl);
        showResolvedSuggestion({
          latitude: result.latitude,
          longitude: result.longitude,
          description: result.address,
        });
      } catch (err) {
        setSuggestions([]);
        setPreviewCoords(null);
        setShowSuggestions(true);
        setSearchError(placesSearchErrorMessage(err));
      } finally {
        setSearching(false);
        setSearchStatus(null);
      }
      return true;
    },
    [showResolvedSuggestion],
  );

  const runLocationSearch = useCallback(
    async (query: string, token: string) => {
      const trimmed = query.trim();
      if (await resolveCoordinateInput(trimmed)) {
        return;
      }
      if (await resolveMapsLinkInput(trimmed)) {
        return;
      }
      await runAutocomplete(query, token);
    },
    [resolveCoordinateInput, resolveMapsLinkInput, runAutocomplete],
  );

  function onAddressInputChange(text: string): void {
    onAddressChange(text);
    onCoordinatesChange(null, null);
    setSuggestions([]);
    setPreviewCoords(null);
    setSearchError(null);
    setSearchStatus(null);

    if (skipAutocompleteRef.current) {
      skipAutocompleteRef.current = false;
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const trimmed = text.trim();
    if (
      trimmed.length < 2 &&
      !looksLikeGoogleMapsUrl(trimmed) &&
      !isCoordinateLikeInput(trimmed)
    ) {
      setShowSuggestions(false);
      return;
    }

    setShowSuggestions(true);
    debounceRef.current = setTimeout(() => {
      void runLocationSearch(text, sessionTokenRef.current);
    }, AUTOCOMPLETE_DEBOUNCE_MS);
  }

  async function onSelectSuggestion(item: LocationSuggestion): Promise<void> {
    Keyboard.dismiss();
    setShowSuggestions(false);
    setSuggestions([]);
    setSearchError(null);
    setSelecting(true);

    try {
      if (item.kind === 'resolved') {
        skipAutocompleteRef.current = true;
        onAddressChange(item.description);
        onCoordinatesChange(item.latitude, item.longitude);
        setPreviewCoords(null);
        recenterMap(item.latitude, item.longitude);
        return;
      }

      const details = await placesDetails(item.placeId, sessionTokenRef.current);
      skipAutocompleteRef.current = true;
      // Keep the autocomplete line the user tapped — not Places formattedAddress alone.
      onAddressChange(item.description);
      onCoordinatesChange(details.latitude, details.longitude);
      setPreviewCoords(null);
      recenterMap(details.latitude, details.longitude);
      sessionTokenRef.current = createPlacesSessionToken();
    } catch (err) {
      skipAutocompleteRef.current = true;
      onAddressChange(item.description);
      onCoordinatesChange(null, null);
      setPreviewCoords(null);
      setSearchError(placesSearchErrorMessage(err));
      sessionTokenRef.current = createPlacesSessionToken();
    } finally {
      setSelecting(false);
    }
  }

  function scheduleReverseGeocode(lat: number, lng: number): void {
    if (reverseDebounceRef.current) {
      clearTimeout(reverseDebounceRef.current);
    }
    reverseDebounceRef.current = setTimeout(() => {
      setUpdatingAddress(true);
      void placesReverse(lat, lng)
        .then((result) => {
          skipAutocompleteRef.current = true;
          onAddressChange(result.address);
        })
        .catch(() => {
          /* keep coordinates and previous address on failure */
        })
        .finally(() => {
          setUpdatingAddress(false);
        });
    }, REVERSE_GEOCODE_DEBOUNCE_MS);
  }

  function onMarkerPositionSet(lat: number, lng: number): void {
    onCoordinatesChange(lat, lng);
    setPreviewCoords(null);
    scheduleReverseGeocode(lat, lng);
  }

  const inputBusy = searching || selecting || updatingAddress;

  return (
    <View className="gap-3" onLayout={onLayout}>
      <TextInput
        label={label}
        value={address}
        onChangeText={onAddressInputChange}
        onFocus={() => {
          if (
            trimmedAddress.length >= 2 ||
            looksLikeGoogleMapsUrl(trimmedAddress) ||
            isCoordinateLikeInput(trimmedAddress)
          ) {
            setShowSuggestions(true);
          }
        }}
        placeholder="Venue, city, coordinates, or Google Maps link"
        leadingIcon={<Ionicons name="location-outline" size={20} color={FIELD_ORANGE} />}
        rightAccessory={
          inputBusy ? <ActivityIndicator size="small" color={FIELD_ORANGE} /> : null
        }
      />

      {updatingAddress ? (
        <Text className="font-sans text-sm text-on-surface-variant">Updating address…</Text>
      ) : null}

      {showSuggestions && suggestions.length > 0 ? (
        <View
          className="overflow-hidden rounded-control border border-border bg-surface"
          style={INPUT_SHADOW_STYLE}
        >
          {suggestions.map((item) => (
            <Pressable
              key={suggestionKey(item)}
              onPress={() => void onSelectSuggestion(item)}
              className="border-b border-border px-4 py-3 active:bg-surface-container"
              accessibilityRole="button"
              accessibilityLabel={item.description}
            >
              <Text className="font-sans text-sm text-on-surface">{item.description}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {searchStatus ? (
        <Text className="font-sans text-sm text-on-surface-variant">{searchStatus}</Text>
      ) : null}

      <FormErrorText>{searchError}</FormErrorText>

      {showEmptyState ? (
        <Text className="font-sans text-sm text-on-surface-variant">
          No locations found. Try a different search.
        </Text>
      ) : null}

      {hasMapPreview && displayLatitude != null && displayLongitude != null ? (
        <TournamentLocationMap
          ref={mapRef}
          latitude={displayLatitude}
          longitude={displayLongitude}
          initialRegion={initialMapRegion}
          isPreviewOnly={isPreviewOnly}
          onCoordinateChange={onMarkerPositionSet}
          onRegionChange={(region) => {
            mapRegionRef.current = region;
          }}
        />
      ) : (
        <View className="h-32 items-center justify-center rounded-control border border-dashed border-primary/30 bg-primary-50/30 px-4">
          <Ionicons name="map-outline" size={28} color={FIELD_ORANGE} />
          <Text className="mt-2 text-center font-sans text-sm text-on-surface-variant">
            Select a location from the suggestions to preview it on the map.
          </Text>
        </View>
      )}
    </View>
  );
}
