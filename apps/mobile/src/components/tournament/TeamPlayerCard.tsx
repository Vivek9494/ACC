import type { TeamDetailPlayerRow } from '@acc/types';
import { MaterialIcons } from '@expo/vector-icons';
import { View } from 'react-native';
import { colors } from '@/theme/colors';

import { PlayerAvatar } from '../tournament/PlayerAvatar';
import { Button } from '../ui/Button';
import { Text } from '../ui/Text';

export interface TeamPlayerCardProps {
  player: TeamDetailPlayerRow;
  showViewProfile: boolean;
  onViewProfile: () => void;
}

function RoleBadge({ label }: { label: string }): React.ReactElement {
  return (
    <View className="flex-row items-center gap-1">
      <MaterialIcons name="verified" size={14} color={colors.secondary} />
      <Text className="font-sans-semibold text-xs text-on-surface-variant">{label}</Text>
    </View>
  );
}

/** One roster player on the Team Detail screen. */
export function TeamPlayerCard({
  player,
  showViewProfile,
  onViewProfile,
}: TeamPlayerCardProps): React.ReactElement {
  const hasMeta =
    player.isCaptain ||
    player.isViceCaptain ||
    player.isManager ||
    player.mobileNumber != null;

  return (
    <View className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest p-3">
      <View className="flex-row gap-3">
        <PlayerAvatar
          firstName={player.firstName}
          profilePhotoUrl={player.profilePhotoUrl}
          size="md"
          shape="circle"
        />
        <View className="min-w-0 flex-1">
          <Text className="font-sans-bold text-base text-on-surface" numberOfLines={2}>
            {player.firstName} {player.lastName}
          </Text>

          {hasMeta || showViewProfile ? (
            <View className="mt-1 flex-row items-center gap-2">
              <View className="min-w-0 flex-1 gap-1">
                {player.isCaptain ? <RoleBadge label="Captain" /> : null}
                {player.isViceCaptain ? <RoleBadge label="Vice-Captain" /> : null}
                {player.isManager ? <RoleBadge label="Manager" /> : null}
                {player.mobileNumber ? (
                  <Text
                    className="font-sans text-sm text-on-surface-variant"
                    numberOfLines={1}
                  >
                    {player.mobileNumber}
                  </Text>
                ) : null}
              </View>

              {showViewProfile ? (
                <View className="shrink-0">
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
          ) : null}
        </View>
      </View>
    </View>
  );
}
