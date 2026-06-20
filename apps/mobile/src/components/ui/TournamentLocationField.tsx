import { Ionicons } from '@expo/vector-icons';
import type { PlaceSuggestion } from '@acc/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import MapView, {
  Marker,
  type MapPressEvent,
  type MarkerDragStartEndEvent,
  type Region,
} from 'react-native-maps';

import { ApiRequestError, placesAutocomplete, placesDetails, placesReverse } from '../../lib/api';
import { createPlacesSessionToken } from '../../lib/places-session';
import { FIELD_ORANGE, INPUT_SHADOW_STYLE } from './fieldStyles';
import { FormErrorText } from './FormErrorText';
import { Text } from './Text';
import { TextInput } from './TextInput';

/** Default map center (Toronto) when no place is selected yet. */
const DEFAULT_REGION: Region = {
  latitude: 43.6532,
  longitude: -79.3832,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const SELECTED_REGION_DELTA = 0.02;
const AUTOCOMPLETE_DEBOUNCE_MS = 350;
const REVERSE_GEOCODE_DEBOUNCE_MS = 400;
const ZOOM_FACTOR = 0.5;

function placesSearchErrorMessage(err: unknown): string {
  if (err instanceof ApiRequestError) {
    if (err.error.code === 'PLACES_UNAVAILABLE') {
      return 'Location search is not configured on the server.';
    }
    if (err.error.code === 'PLACES_RATE_LIMIT') {
      return 'Too many searches. Wait a moment and try again.';
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

function regionForCoordinate(latitude: number, longitude: number, delta = SELECTED_REGION_DELTA): Region {
  return {
    latitude,
    longitude,
    latitudeDelta: delta,
    longitudeDelta: delta,
  };
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
  const mapRef = useRef<MapView>(null);
  const mapRegionRef = useRef<Region>(DEFAULT_REGION);

  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [updatingAddress, setUpdatingAddress] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const hasCoordinates = latitude != null && longitude != null;
  const trimmedAddress = address.trim();
  const showEmptyState =
    showSuggestions && !searching && !searchError && trimmedAddress.length >= 2 && suggestions.length === 0;

  const initialMapRegion = hasCoordinates
    ? regionForCoordinate(latitude, longitude)
    : DEFAULT_REGION;

  useEffect(() => {
    if (hasCoordinates) {
      mapRegionRef.current = regionForCoordinate(latitude, longitude);
    }
  }, [hasCoordinates, latitude, longitude]);

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

  const adjustZoom = useCallback(async (direction: 1 | -1) => {
    const camera = await mapRef.current?.getCamera();
    if (camera?.zoom != null) {
      await mapRef.current?.animateCamera(
        { zoom: Math.max(1, camera.zoom + direction) },
        { duration: 200 },
      );
      return;
    }

    const current = mapRegionRef.current;
    const factor = direction > 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
    const next: Region = {
      ...current,
      latitudeDelta: Math.min(Math.max(current.latitudeDelta * factor, 0.0005), 80),
      longitudeDelta: Math.min(Math.max(current.longitudeDelta * factor, 0.0005), 80),
    };
    mapRegionRef.current = next;
    mapRef.current?.animateToRegion(next, 200);
  }, []);

  const runAutocomplete = useCallback(async (query: string, token: string) => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setSearchError(null);
      setShowSuggestions(false);
      setSearching(false);
      return;
    }

    setSearching(true);
    setSearchError(null);
    try {
      const results = await placesAutocomplete(trimmed, token);
      setSuggestions(results);
      setShowSuggestions(true);
    } catch (err) {
      setSuggestions([]);
      setShowSuggestions(true);
      setSearchError(placesSearchErrorMessage(err));
    } finally {
      setSearching(false);
    }
  }, []);

  function onAddressInputChange(text: string): void {
    onAddressChange(text);
    onCoordinatesChange(null, null);
    setSuggestions([]);
    setSearchError(null);

    if (skipAutocompleteRef.current) {
      skipAutocompleteRef.current = false;
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (text.trim().length < 2) {
      setShowSuggestions(false);
      return;
    }

    setShowSuggestions(true);
    debounceRef.current = setTimeout(() => {
      void runAutocomplete(text, sessionTokenRef.current);
    }, AUTOCOMPLETE_DEBOUNCE_MS);
  }

  async function onSelectSuggestion(item: PlaceSuggestion): Promise<void> {
    Keyboard.dismiss();
    setShowSuggestions(false);
    setSuggestions([]);
    setSearchError(null);
    setSelecting(true);

    try {
      const details = await placesDetails(item.placeId, sessionTokenRef.current);
      skipAutocompleteRef.current = true;
      onAddressChange(details.address);
      onCoordinatesChange(details.latitude, details.longitude);
      recenterMap(details.latitude, details.longitude);
      sessionTokenRef.current = createPlacesSessionToken();
    } catch (err) {
      skipAutocompleteRef.current = true;
      onAddressChange(item.description);
      onCoordinatesChange(null, null);
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
    scheduleReverseGeocode(lat, lng);
  }

  function onMarkerDragEnd(event: MarkerDragStartEndEvent): void {
    const { latitude: lat, longitude: lng } = event.nativeEvent.coordinate;
    onMarkerPositionSet(lat, lng);
  }

  function onMapPress(event: MapPressEvent): void {
    const { latitude: lat, longitude: lng } = event.nativeEvent.coordinate;
    onMarkerPositionSet(lat, lng);
  }

  function onRegionChangeComplete(region: Region): void {
    mapRegionRef.current = region;
  }

  const inputBusy = searching || selecting || updatingAddress;

  return (
    <View className="gap-3" onLayout={onLayout}>
      <TextInput
        label={label}
        value={address}
        onChangeText={onAddressInputChange}
        onFocus={() => {
          if (trimmedAddress.length >= 2) {
            setShowSuggestions(true);
          }
        }}
        placeholder="Search venue or city..."
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
              key={item.placeId}
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

      {searching ? (
        <Text className="font-sans text-sm text-on-surface-variant">Searching locations…</Text>
      ) : null}

      <FormErrorText>{searchError}</FormErrorText>

      {showEmptyState ? (
        <Text className="font-sans text-sm text-on-surface-variant">
          No locations found. Try a different search.
        </Text>
      ) : null}

      {hasCoordinates ? (
        <View className="overflow-hidden rounded-control" style={INPUT_SHADOW_STYLE}>
          <View className="relative">
            <MapView
              ref={mapRef}
              style={{ height: 192, width: '100%' }}
              initialRegion={initialMapRegion}
              scrollEnabled
              zoomEnabled
              zoomControlEnabled={Platform.OS === 'android'}
              rotateEnabled
              pitchEnabled={false}
              onPress={onMapPress}
              onRegionChangeComplete={onRegionChangeComplete}
            >
              <Marker
                coordinate={{ latitude, longitude }}
                draggable
                onDragEnd={onMarkerDragEnd}
              />
            </MapView>

            <View className="absolute bottom-3 right-3 gap-2">
              <Pressable
                onPress={() => void adjustZoom(1)}
                accessibilityRole="button"
                accessibilityLabel="Zoom in"
                className="h-9 w-9 items-center justify-center rounded-full bg-surface active:bg-surface-container"
                style={INPUT_SHADOW_STYLE}
              >
                <Ionicons name="add" size={20} color={FIELD_ORANGE} />
              </Pressable>
              <Pressable
                onPress={() => void adjustZoom(-1)}
                accessibilityRole="button"
                accessibilityLabel="Zoom out"
                className="h-9 w-9 items-center justify-center rounded-full bg-surface active:bg-surface-container"
                style={INPUT_SHADOW_STYLE}
              >
                <Ionicons name="remove" size={20} color={FIELD_ORANGE} />
              </Pressable>
            </View>
          </View>
          <Text className="mt-1 font-sans text-xs text-on-surface-variant">
            Pinch to zoom, drag the marker, or tap the map to fine-tune the location.
          </Text>
        </View>
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
