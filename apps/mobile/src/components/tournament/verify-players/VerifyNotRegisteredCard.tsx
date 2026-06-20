import type { CenterPlayerRosterEntry } from '@acc/types';
import { View } from 'react-native';

import { INPUT_SHADOW_STYLE } from '../../ui/fieldStyles';
import { Text } from '../../ui/Text';
import { PlayerAvatarWithStatus } from './PlayerAvatarWithStatus';

export function VerifyNotRegisteredCard({
  player,
}: {
  player: CenterPlayerRosterEntry;
}): React.ReactElement {
  return (
    <View
      className="flex-row items-center gap-3 rounded-lg border border-outline-variant bg-surface px-4 py-3"
      style={INPUT_SHADOW_STYLE}
    >
      <PlayerAvatarWithStatus
        firstName={player.firstName}
        profilePhotoUrl={player.profilePhotoUrl}
        size="sm"
      />
      <View className="min-w-0 flex-1">
        <Text className="font-sans-bold text-base text-on-surface" numberOfLines={1}>
          {player.firstName} {player.lastName}
        </Text>
        <Text className="font-sans text-sm text-on-surface-variant" numberOfLines={1}>
          {player.mobileNumber}
        </Text>
      </View>
      <View className="rounded-full bg-surface-container-high px-3 py-1">
        <Text className="font-sans-medium text-[10px] uppercase tracking-wider text-on-surface-variant">
          Not registered
        </Text>
      </View>
    </View>
  );
}
