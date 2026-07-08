import { useState } from 'react';
import { Image, type ImageProps, View, type StyleProp, type ViewStyle } from 'react-native';

import { resolveMediaDisplayUrl } from '../../lib/media-url';

export interface BroadcastImageProps {
  imageUrl: string;
  height: number;
  className?: string;
  resizeMode?: ImageProps['resizeMode'];
  containerClassName?: string;
  containerStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/** Broadcast image with API-host rewrite (dev localhost → device LAN) and load error logging. */
export function BroadcastImage({
  imageUrl,
  height,
  className,
  resizeMode = 'cover',
  containerClassName,
  containerStyle,
  accessibilityLabel = 'Broadcast image',
}: BroadcastImageProps): React.ReactElement | null {
  const resolvedUri = resolveMediaDisplayUrl(imageUrl);
  const [failed, setFailed] = useState(false);

  if (!resolvedUri || failed) {
    if (failed) {
      return null;
    }
    console.warn('[ACC] Broadcast image URL could not be resolved', { imageUrl });
    return null;
  }

  return (
    <View className={containerClassName} style={[{ width: '100%', height }, containerStyle]}>
      <Image
        source={{ uri: resolvedUri }}
        style={{ width: '100%', height }}
        className={className}
        resizeMode={resizeMode}
        accessibilityLabel={accessibilityLabel}
        onError={(event) => {
          console.warn('[ACC] Broadcast image failed to load', {
            imageUrl,
            resolvedUri,
            error: event.nativeEvent.error,
          });
          setFailed(true);
        }}
      />
    </View>
  );
}
