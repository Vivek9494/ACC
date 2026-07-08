import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { Platform, Pressable, View } from 'react-native';
import MapView, {
  Marker,
  type MapPressEvent,
  type MarkerDragStartEndEvent,
} from 'react-native-maps';

import { FIELD_ORANGE, INPUT_SHADOW_STYLE } from './fieldStyles';
import type { MapRegion } from './map-region';
import { Text } from './Text';
import type {
  TournamentLocationMapHandle,
  TournamentLocationMapProps,
} from './TournamentLocationMap';

const ZOOM_FACTOR = 0.5;

export const TournamentLocationMap = forwardRef<
  TournamentLocationMapHandle,
  TournamentLocationMapProps
>(function TournamentLocationMap(
  {
    latitude,
    longitude,
    initialRegion,
    isPreviewOnly,
    onCoordinateChange,
    onRegionChange,
  },
  ref,
) {
  const mapRef = useRef<MapView>(null);
  const mapRegionRef = useRef<MapRegion>(initialRegion);

  const animateToRegion = useCallback((region: MapRegion, duration = 300) => {
    mapRegionRef.current = region;
    mapRef.current?.animateToRegion(region, duration);
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
    const next: MapRegion = {
      ...current,
      latitudeDelta: Math.min(Math.max(current.latitudeDelta * factor, 0.0005), 80),
      longitudeDelta: Math.min(Math.max(current.longitudeDelta * factor, 0.0005), 80),
    };
    animateToRegion(next, 200);
  }, [animateToRegion]);

  useImperativeHandle(
    ref,
    () => ({
      animateToRegion,
      adjustZoom,
    }),
    [adjustZoom, animateToRegion],
  );

  function onMarkerDragEnd(event: MarkerDragStartEndEvent): void {
    const { latitude: lat, longitude: lng } = event.nativeEvent.coordinate;
    onCoordinateChange(lat, lng);
  }

  function onMapPress(event: MapPressEvent): void {
    if (isPreviewOnly) {
      return;
    }
    const { latitude: lat, longitude: lng } = event.nativeEvent.coordinate;
    onCoordinateChange(lat, lng);
  }

  return (
    <View className="overflow-hidden rounded-control" style={INPUT_SHADOW_STYLE}>
      <View className="relative">
        <MapView
          ref={mapRef}
          style={{ height: 192, width: '100%' }}
          initialRegion={initialRegion}
          scrollEnabled
          zoomEnabled
          zoomControlEnabled={Platform.OS === 'android'}
          rotateEnabled
          pitchEnabled={false}
          onPress={onMapPress}
          onRegionChangeComplete={(region) => {
            mapRegionRef.current = region;
            onRegionChange(region);
          }}
        >
          <Marker
            coordinate={{ latitude, longitude }}
            draggable={!isPreviewOnly}
            onDragEnd={isPreviewOnly ? undefined : onMarkerDragEnd}
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
        {isPreviewOnly
          ? 'Tap the suggestion above to confirm this location.'
          : 'Pinch to zoom, drag the marker, or tap the map to fine-tune the location.'}
      </Text>
    </View>
  );
});
