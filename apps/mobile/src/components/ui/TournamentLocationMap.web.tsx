import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useImperativeHandle } from 'react';
import { View } from 'react-native';

import { FIELD_ORANGE, INPUT_SHADOW_STYLE } from './fieldStyles';
import { Text } from './Text';
import type {
  TournamentLocationMapHandle,
  TournamentLocationMapProps,
} from './TournamentLocationMap';

/** Web fallback — interactive map is native-only; coordinates still display for preview. */
export const TournamentLocationMap = forwardRef<
  TournamentLocationMapHandle,
  TournamentLocationMapProps
>(function TournamentLocationMapWeb(
  { latitude, longitude, isPreviewOnly },
  ref,
) {
  useImperativeHandle(ref, () => ({
    animateToRegion: () => undefined,
    adjustZoom: async () => undefined,
  }));

  return (
    <View className="overflow-hidden rounded-control" style={INPUT_SHADOW_STYLE}>
      <View className="h-48 items-center justify-center bg-primary-50/40 px-4">
        <Ionicons name="map-outline" size={32} color={FIELD_ORANGE} />
        <Text className="mt-2 font-sans-semibold text-sm text-on-surface">
          {latitude.toFixed(5)}, {longitude.toFixed(5)}
        </Text>
        <Text className="mt-1 text-center font-sans text-xs text-on-surface-variant">
          Map preview is available in the iOS and Android app.
        </Text>
      </View>
      <Text className="mt-1 font-sans text-xs text-on-surface-variant">
        {isPreviewOnly
          ? 'Tap the suggestion above to confirm this location.'
          : 'Use address search or coordinates to set the tournament location.'}
      </Text>
    </View>
  );
});
