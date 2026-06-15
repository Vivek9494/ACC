import { Image, View } from 'react-native';

import { INPUT_SHADOW_STYLE } from './fieldStyles';
import { Text } from './Text';

export interface TournamentPosterBannerProps {
  posterUrl: string | null;
  name: string;
  className?: string;
}

/**
 * Full-bleed tournament poster banner. Shadow on the outer shell; inner clip rounds
 * corners at 8px (`rounded-control`) without clipping the shadow.
 */
export function TournamentPosterBanner({
  posterUrl,
  name,
  className,
}: TournamentPosterBannerProps): React.ReactElement {
  return (
    <View className={className}>
      <View className="rounded-control bg-white" style={INPUT_SHADOW_STYLE}>
        <View className="overflow-hidden rounded-control">
          <View className="relative h-44 w-full bg-surface-container-high">
            {posterUrl ? (
              <Image source={{ uri: posterUrl }} className="h-full w-full" resizeMode="cover" />
            ) : (
              <View className="h-full w-full items-center justify-center bg-surface-container-high">
                <Text className="font-sans-bold text-4xl text-on-surface-variant">
                  {name.slice(0, 1).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}
