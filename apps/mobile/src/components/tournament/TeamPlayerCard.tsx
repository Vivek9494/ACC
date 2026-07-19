import type { TeamDetailPlayerRow } from '@acc/types';
import { formatCanadianMobileForDisplay } from '@acc/types';
import { MaterialIcons } from '@expo/vector-icons';
import { ActivityIndicator, Linking, Pressable, View } from 'react-native';
import { colors } from '@/theme/colors';

import { copyTextToClipboard } from '../../lib/copy-text';
import { PlayerAvatar } from '../tournament/PlayerAvatar';
import { Button } from '../ui/Button';
import { Text } from '../ui/Text';

export interface TeamPlayerCardProps {
  player: TeamDetailPlayerRow;
  showViewProfile: boolean;
  onViewProfile: () => void;
  onRemove?: () => void;
  removing?: boolean;
}

function RoleBadge({ label }: { label: string }): React.ReactElement {
  return (
    <View className="flex-row items-center gap-1">
      <MaterialIcons name="verified" size={14} color={colors.secondary} />
      <Text className="font-sans-semibold text-xs text-on-surface-variant">{label}</Text>
    </View>
  );
}

function MobileNumberLink({ mobileNumber }: { mobileNumber: string }): React.ReactElement {
  const display = formatCanadianMobileForDisplay(mobileNumber);
  return (
    <Pressable
      onPress={() => void Linking.openURL(`tel:${mobileNumber}`)}
      onLongPress={() => void copyTextToClipboard(mobileNumber)}
      accessibilityRole="link"
      accessibilityLabel={`Call ${display}`}
      accessibilityHint="Long press to copy number"
      hitSlop={4}
    >
      <Text className="font-sans text-sm text-primary" numberOfLines={1}>
        {display}
      </Text>
    </Pressable>
  );
}

/** One roster player on the Team Detail screen. */
export function TeamPlayerCard({
  player,
  showViewProfile,
  onViewProfile,
  onRemove,
  removing = false,
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

          {hasMeta || showViewProfile || onRemove ? (
            <View className="mt-1 flex-row items-center gap-2">
              <View className="min-w-0 flex-1 gap-1">
                {player.isCaptain ? <RoleBadge label="Captain" /> : null}
                {player.isViceCaptain ? <RoleBadge label="Vice-Captain" /> : null}
                {player.isManager ? <RoleBadge label="Manager" /> : null}
                {player.mobileNumber ? (
                  <MobileNumberLink mobileNumber={player.mobileNumber} />
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

              {onRemove ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${player.firstName} ${player.lastName} from team`}
                  disabled={removing}
                  hitSlop={8}
                  onPress={onRemove}
                  className="h-9 w-9 shrink-0 items-center justify-center rounded-full"
                >
                  {removing ? (
                    <ActivityIndicator size="small" color={colors.textMuted} />
                  ) : (
                    <MaterialIcons name="delete-outline" size={22} color={colors.textMuted} />
                  )}
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}
