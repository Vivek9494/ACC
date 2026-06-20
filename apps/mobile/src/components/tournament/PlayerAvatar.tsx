import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';

import { Text } from '../ui/Text';

export type PlayerAvatarSize = 'sm' | 'md' | 'lg';

export type PlayerAvatarShape = 'circle' | 'square';

const SIZE_CLASS: Record<PlayerAvatarSize, string> = {
  sm: 'h-12 w-12',
  md: 'h-14 w-14',
  lg: 'h-32 w-32',
};

const RADIUS_CLASS: Record<PlayerAvatarShape, string> = {
  circle: 'rounded-full',
  square: 'rounded-2xl',
};

export interface PlayerAvatarProps {
  firstName: string;
  profilePhotoUrl?: string | null;
  size?: PlayerAvatarSize;
  shape?: PlayerAvatarShape;
  /** Gold border for the top-ranked player card. */
  highlighted?: boolean;
}

/** Circular player photo with initial fallback — shared on leaderboard cards. */
export function PlayerAvatar({
  firstName,
  profilePhotoUrl,
  size = 'md',
  shape = 'circle',
  highlighted = false,
}: PlayerAvatarProps): React.ReactElement {
  const dimension = SIZE_CLASS[size];
  const radius = RADIUS_CLASS[shape];
  const initial = firstName.slice(0, 1).toUpperCase();
  const resolvedUrl = profilePhotoUrl?.trim() || null;
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [resolvedUrl]);

  const borderClass = highlighted ? 'border-2 border-primary' : 'border border-outline-variant';

  if (resolvedUrl && !imageFailed) {
    return (
      <View className={`${dimension} overflow-hidden ${radius} ${borderClass}`}>
        <Image
          source={{ uri: resolvedUrl }}
          className={dimension}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
          onError={() => setImageFailed(true)}
        />
      </View>
    );
  }

  return (
    <View
      className={`${dimension} items-center justify-center ${radius} bg-surface-container-high ${borderClass}`}
    >
      <Text className={`font-sans-bold ${size === 'lg' ? 'text-3xl' : 'text-lg'} text-primary`}>
        {initial}
      </Text>
    </View>
  );
}
