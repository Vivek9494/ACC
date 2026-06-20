import type { TeamDetailPlayerRow } from '@acc/types';
import { MaterialIcons } from '@expo/vector-icons';
import { View } from 'react-native';
import { colors } from '@/theme/colors';

import { PlayerAvatar } from '../tournament/PlayerAvatar';
import { Button } from '../ui/Button';
import { Text } from '../ui/Text';
import { VerifyPlayerRatingsRow } from '../tournament/verify-players/VerifyPlayerRatingsRow';

export interface TeamPlayerCardProps {
  player: TeamDetailPlayerRow;
  showViewProfile: boolean;
  onViewProfile: () => void;
}

/** One roster player on the Team Detail screen. */
export function TeamPlayerCard({
  player,
  showViewProfile,
  onViewProfile,
}: TeamPlayerCardProps): React.ReactElement {
  return (
    <View className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
      <View className="flex-row items-center gap-4">
        <PlayerAvatar
          firstName={player.firstName}
          profilePhotoUrl={player.profilePhotoUrl}
          size="md"
          shape="circle"
        />
        <View className="min-w-0 flex-1">
          <Text className="font-sans-bold text-base text-on-surface">
            {player.firstName} {player.lastName}
          </Text>
          {player.isCaptain ? (
            <View className="mt-1 flex-row items-center gap-1">
              <MaterialIcons name="verified" size={14} color={colors.secondary} />
              <Text className="font-sans-semibold text-xs text-on-surface-variant">Captain</Text>
            </View>
          ) : null}
          {player.isViceCaptain ? (
            <View className="mt-1 flex-row items-center gap-1">
              <MaterialIcons name="verified" size={14} color={colors.secondary} />
              <Text className="font-sans-semibold text-xs text-on-surface-variant">
                Vice-Captain
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View className="mt-4 rounded-lg bg-background px-2 py-1">
        <VerifyPlayerRatingsRow
          batting={player.battingRating}
          bowling={player.bowlingRating}
          fielding={player.fieldingRating}
        />
      </View>

      {showViewProfile ? (
        <View className="mt-4 flex-row justify-end">
          <Button
            variant="amber"
            label="View Profile"
            onPress={onViewProfile}
            className="h-9 rounded-full px-4"
            textClassName="text-xs"
          />
        </View>
      ) : null}
    </View>
  );
}
