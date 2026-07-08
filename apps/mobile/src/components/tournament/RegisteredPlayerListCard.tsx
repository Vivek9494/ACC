import type { VerifiedRegisteredPlayerRow } from '@acc/types';
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { colors } from '@/theme/colors';

import { PlayerAvatar } from '../tournament/PlayerAvatar';
import { VerifyPlayerRatingsRow } from '../tournament/verify-players/VerifyPlayerRatingsRow';
import { Button } from '../ui/Button';
import { Text } from '../ui/Text';

export interface RegisteredPlayerListCardProps {
  player: VerifiedRegisteredPlayerRow;
  onPress?: () => void;
  onToggleFavourite?: () => void;
  favouritePending?: boolean;
  onViewProfile?: () => void;
  onViewVideo?: () => void;
}

/** One verified registrant on the Registered Players / Favourite Players lists. */
export function RegisteredPlayerListCard({
  player,
  onPress,
  onToggleFavourite,
  favouritePending = false,
  onViewProfile,
  onViewVideo,
}: RegisteredPlayerListCardProps): React.ReactElement {
  const showNameRowActions = onToggleFavourite != null || onViewProfile != null;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className="overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 active:opacity-90"
    >
      <View className="flex-row items-center gap-3">
        <PlayerAvatar
          firstName={player.firstName}
          profilePhotoUrl={player.profilePhotoUrl}
          size="md"
          shape="circle"
        />
        <View className="min-w-0 flex-1">
          <Text className="font-sans-bold text-lg text-on-surface" numberOfLines={1}>
            {player.firstName} {player.lastName}
          </Text>
          <Text
            className="mt-0.5 font-sans text-sm text-on-surface-variant"
            numberOfLines={1}
          >
            {player.centerName}
          </Text>
        </View>
        {showNameRowActions ? (
          <View className="shrink-0 flex-row items-center gap-2">
            {onViewProfile ? (
              <Button
                variant="amber"
                label="View Profile"
                onPress={onViewProfile}
                className="h-9 shrink-0 rounded-full px-3"
                textClassName="text-xs"
              />
            ) : null}
            {onToggleFavourite ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={player.isFavourited ? 'Remove favourite' : 'Add favourite'}
                className="p-1"
                disabled={favouritePending}
                onPress={onToggleFavourite}
              >
                <MaterialIcons
                  name={player.isFavourited ? 'favorite' : 'favorite-border'}
                  size={24}
                  color={player.isFavourited ? colors.secondary : colors.textMuted}
                />
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      <View className="mt-4 rounded-lg bg-surface-container-low px-2 py-2">
        <VerifyPlayerRatingsRow
          batting={player.battingRating}
          bowling={player.bowlingRating}
          fielding={player.fieldingRating}
        />
      </View>

      {player.hasSkillVideo && onViewVideo ? (
        <View className="mt-4 flex-row justify-end">
          <Button
            variant="outline"
            label="View Video"
            onPress={onViewVideo}
            className="h-9 rounded-full border-primary px-4"
            textClassName="text-xs text-primary"
          />
        </View>
      ) : null}
    </Pressable>
  );
}
