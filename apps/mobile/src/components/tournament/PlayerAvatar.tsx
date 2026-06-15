import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';

import { Text } from '../ui/Text';

export type PlayerAvatarSize = 'md' | 'sm';

const SIZE_CLASS: Record<PlayerAvatarSize, string> = {
  sm: 'h-12 w-12',
  md: 'h-14 w-14',
};

export interface PlayerAvatarProps {
  firstName: string;
  profilePhotoUrl?: string | null;
  size?: PlayerAvatarSize;
  /** Gold border for the top-ranked player card. */
  highlighted?: boolean;
}

/** Circular player photo with initial fallback — shared on leaderboard cards. */
export function PlayerAvatar({
  firstName,
  profilePhotoUrl,
  size = 'md',
  highlighted = false,
}: PlayerAvatarProps): React.ReactElement {
  const dimension = SIZE_CLASS[size];
  const initial = firstName.slice(0, 1).toUpperCase();
  const resolvedUrl = profilePhotoUrl?.trim() || null;
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [resolvedUrl]);

  const borderClass = highlighted ? 'border-2 border-primary' : 'border border-outline-variant';

  if (resolvedUrl && !imageFailed) {
    return (
      <View className={`${dimension} overflow-hidden rounded-full ${borderClass}`}>
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
      className={`${dimension} items-center justify-center rounded-full bg-surface-container-high ${borderClass}`}
    >
      <Text className="font-sans-bold text-lg text-primary">{initial}</Text>
    </View>
  );
}
