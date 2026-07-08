import { Image, View } from 'react-native';

import { resolveMediaDisplayUrl } from '../../lib/media-url';
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
  const displayPosterUrl = resolveMediaDisplayUrl(posterUrl);

  if (__DEV__ && posterUrl) {
    console.log('[TournamentPosterBanner] poster source', {
      raw: posterUrl.slice(0, 120),
      display: displayPosterUrl?.slice(0, 120) ?? null,
      isPresigned: posterUrl.includes('X-Amz-Signature='),
      isStorageKey: posterUrl.startsWith('posters/'),
    });
  }

  return (
    <View className={className}>
      <View className="rounded-control bg-surface" style={INPUT_SHADOW_STYLE}>
        <View className="overflow-hidden rounded-control">
          <View className="relative h-44 w-full bg-surface-container-high">
            {displayPosterUrl ? (
              <Image
                source={{ uri: displayPosterUrl }}
                className="h-full w-full"
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
                onError={(event) => {
                  if (__DEV__) {
                    console.warn('[TournamentPosterBanner] poster failed to load', {
                      uri: displayPosterUrl.slice(0, 160),
                      error: event.nativeEvent.error,
                    });
                  }
                }}
              />
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
