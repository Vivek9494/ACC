import type { TournamentPlayerProfileView } from '@acc/types';
import { formatPlayerProfileDisplayName } from '@acc/types';
import { MaterialIcons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { PlayerAvatar } from '../PlayerAvatar';
import { Text } from '../../ui/Text';
import { colors } from '@/theme/colors';

export interface PlayerProfileHeaderProps {
  profile: Pick<
    TournamentPlayerProfileView,
    | 'firstName'
    | 'lastName'
    | 'profilePhotoUrl'
    | 'playerRoleLabel'
    | 'centerName'
    | 'ballTypeLabel'
  >;
  /** Rendered at the right end of the center-badge row (e.g. admin edit action). */
  centerRowTrailing?: ReactNode;
}

function ProfileBadge({
  icon,
  label,
  variant = 'default',
}: {
  icon: 'bolt' | 'location-on';
  label: string;
  variant?: 'default' | 'muted' | 'center';
}): React.ReactElement {
  const textClass =
    variant === 'muted'
      ? 'text-on-surface-variant'
      : variant === 'center'
        ? 'text-tertiary'
        : 'text-tertiary';
  const iconColor =
    variant === 'muted' ? colors.textMuted : colors.secondary;

  return (
    <View className="flex-row items-center gap-1 rounded-full bg-surface-container-low px-3 py-1">
      <MaterialIcons name={icon} size={16} color={iconColor} />
      <Text className={`font-sans-semibold text-xs ${textClass}`}>{label}</Text>
    </View>
  );
}

/** Cover banner, avatar, name, and player-type/center badges. */
export function PlayerProfileHeader({
  profile,
  centerRowTrailing,
}: PlayerProfileHeaderProps): React.ReactElement {
  const displayName = formatPlayerProfileDisplayName(profile.firstName, profile.lastName);
  const showCenterRow = Boolean(profile.centerName) || centerRowTrailing != null;

  return (
    <View className="mb-4 overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest">
      <View className="h-40 bg-primary">
        <View className="absolute inset-0 bg-secondary/30" />
      </View>
      <View className="-mt-16 px-4 pb-4">
        <PlayerAvatar
          firstName={profile.firstName}
          profilePhotoUrl={profile.profilePhotoUrl}
          size="lg"
          shape="square"
        />
        <Text className="mt-4 font-sans-bold text-2xl text-on-surface">{displayName}</Text>
        {profile.playerRoleLabel ? (
          <View className="mt-2 flex-row flex-wrap gap-2">
            <ProfileBadge icon="bolt" label={profile.playerRoleLabel} variant="muted" />
          </View>
        ) : null}
        {showCenterRow ? (
          <View className="mt-2 flex-row items-center justify-between gap-3">
            {profile.centerName ? (
              <ProfileBadge icon="location-on" label={profile.centerName} variant="center" />
            ) : (
              <View />
            )}
            {centerRowTrailing ?? null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function PlayerProfileBallTypeLabel({
  label,
}: {
  label: string;
}): React.ReactElement {
  return (
    <Text className="mb-4 text-center font-sans-semibold text-xs uppercase tracking-wide text-on-surface-variant">
      {label}
    </Text>
  );
}
