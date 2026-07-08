import {
  REGISTRATION_PLAYER_TYPE_OPTIONS,
  type RegistrationSummary,
} from '@acc/types';
import { Pressable, View } from 'react-native';

import { PlayerAvatar } from '../tournament/PlayerAvatar';
import { VerifyPlayerRatingsRow } from '../tournament/verify-players/VerifyPlayerRatingsRow';
import { Text } from '../ui/Text';

function formatPlayerType(
  playerType: RegistrationSummary['playerType'],
): string | null {
  if (!playerType) {
    return null;
  }
  return (
    REGISTRATION_PLAYER_TYPE_OPTIONS.find((option) => option.value === playerType)?.label ??
    null
  );
}

export interface LeatherRegisteredPlayerListCardProps {
  player: RegistrationSummary;
  onPress?: () => void;
}

/** One leather registrant on the View Registered Players list (ACC squad-building). */
export function LeatherRegisteredPlayerListCard({
  player,
  onPress,
}: LeatherRegisteredPlayerListCardProps): React.ReactElement {
  const playerTypeLabel = formatPlayerType(player.playerType);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className="overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 active:opacity-90"
    >
      <View className="flex-row items-start gap-4">
        <PlayerAvatar
          firstName={player.firstName}
          profilePhotoUrl={player.profilePhotoUrl}
          size="md"
          shape="circle"
        />
        <View className="min-w-0 flex-1">
          <Text className="font-sans-bold text-lg text-on-surface">
            {player.firstName} {player.lastName}
          </Text>
          <Text className="mt-1 font-sans text-sm text-on-surface-variant">{player.centerName}</Text>
          {playerTypeLabel ? (
            <Text className="mt-2 font-sans-medium text-sm text-primary">{playerTypeLabel}</Text>
          ) : null}
        </View>
      </View>

      <View className="mt-4 rounded-lg bg-surface-container-low px-2 py-2">
        <VerifyPlayerRatingsRow
          batting={player.battingRating}
          bowling={player.bowlingRating}
          fielding={player.fieldingRating}
        />
      </View>
    </Pressable>
  );
}
