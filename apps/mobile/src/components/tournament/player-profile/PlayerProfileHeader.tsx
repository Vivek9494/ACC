import type { TournamentPlayerProfileView } from '@acc/types';
import { formatPlayerProfileDisplayName } from '@acc/types';
import { MaterialIcons } from '@expo/vector-icons';
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
    | 'isCaptain'
    | 'isViceCaptain'
    | 'centerName'
    | 'ballTypeLabel'
  >;
}

function ProfileBadge({
  icon,
  label,
  variant = 'default',
}: {
  icon: 'workspace-premium' | 'bolt' | 'location-on';
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

/** Cover banner, avatar, name, and role/captain/center badges. */
export function PlayerProfileHeader({ profile }: PlayerProfileHeaderProps): React.ReactElement {
  const displayName = formatPlayerProfileDisplayName(profile.firstName, profile.lastName);

  return (
    <View className="mb-4 overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest">
      <View className="h-40 bg-primary">
        <View className="absolute inset-0 bg-secondary/30" />
      </View>
      <View className="-mt-16 px-4 pb-4">
        <View className="border-4 border-surface shadow-sm">
          <PlayerAvatar
            firstName={profile.firstName}
            profilePhotoUrl={profile.profilePhotoUrl}
            size="lg"
            shape="square"
          />
        </View>
        <Text className="mt-4 font-sans-bold text-2xl text-on-surface">{displayName}</Text>
        <View className="mt-2 flex-row flex-wrap gap-2">
          {profile.isCaptain ? (
            <ProfileBadge icon="workspace-premium" label="Captain" />
          ) : null}
          {profile.isViceCaptain ? (
            <ProfileBadge icon="workspace-premium" label="Vice-Captain" />
          ) : null}
          {profile.centerName ? (
            <ProfileBadge icon="location-on" label={profile.centerName} variant="center" />
          ) : null}
          {profile.playerRoleLabel ? (
            <ProfileBadge icon="bolt" label={profile.playerRoleLabel} variant="muted" />
          ) : null}
        </View>
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
