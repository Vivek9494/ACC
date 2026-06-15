import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';

import { FIELD_ORANGE } from './fieldStyles';

/** Matches Add New Group mockup (`sports_cricket` / Material `sports-cricket`). */
const TEAM_FALLBACK_ICON = 'sports-cricket' as const;

function resolveTeamLogoUrl(logoUrl?: string | null): string | null {
  if (logoUrl == null) {
    return null;
  }
  const trimmed = logoUrl.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export type TeamAvatarSize = 'xs' | 'sm' | 'md';

const SIZE_CLASS: Record<TeamAvatarSize, string> = {
  xs: 'h-9 w-9',
  sm: 'h-8 w-8',
  md: 'h-12 w-12',
};

const ICON_SIZE: Record<TeamAvatarSize, number> = {
  xs: 18,
  sm: 16,
  md: 24,
};

export interface TeamAvatarProps {
  /** Used for accessibility when showing the icon fallback. */
  name: string;
  logoUrl?: string | null;
  size?: TeamAvatarSize;
}

/** Team logo (circular) or cricket-bat icon tile — shared wherever a team is shown. */
export function TeamAvatar({
  name,
  logoUrl,
  size = 'md',
}: TeamAvatarProps): React.ReactElement {
  const dimension = SIZE_CLASS[size];
  const resolvedLogoUrl = resolveTeamLogoUrl(logoUrl);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [resolvedLogoUrl]);

  if (resolvedLogoUrl && !imageFailed) {
    return (
      <View
        className={`${dimension} overflow-hidden rounded-full`}
        accessibilityLabel={`${name} logo`}
      >
        <Image
          source={{ uri: resolvedLogoUrl }}
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
      className={`${dimension} items-center justify-center rounded-control bg-surface-container`}
      accessibilityLabel={name}
    >
      <MaterialIcons name={TEAM_FALLBACK_ICON} size={ICON_SIZE[size]} color={FIELD_ORANGE} />
    </View>
  );
}
