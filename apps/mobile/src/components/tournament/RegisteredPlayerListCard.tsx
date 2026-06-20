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
  onToggleFavourite?: () => void;
  favouritePending?: boolean;
  onViewProfile?: () => void;
  onViewVideo?: () => void;
}

/** One verified registrant on the Registered Players / Favourite Players lists. */
export function RegisteredPlayerListCard({
  player,
  onToggleFavourite,
  favouritePending = false,
  onViewProfile,
  onViewVideo,
}: RegisteredPlayerListCardProps): React.ReactElement {
  return (
    <View className="relative overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4">
      {onToggleFavourite ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={player.isFavourited ? 'Remove favourite' : 'Add favourite'}
          className="absolute right-3 top-3 z-10 p-1"
          disabled={favouritePending}
          onPress={onToggleFavourite}
        >
          <MaterialIcons
            name={player.isFavourited ? 'favorite' : 'favorite-border'}
            size={24}
            color={player.isFavourited ? colors.primary : colors.textMuted}
          />
        </Pressable>
      ) : null}

      <View className="flex-row items-start gap-4 pr-8">
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
          <View className="mt-1 flex-row items-center gap-1">
            <MaterialIcons name="location-on" size={14} color={colors.textMuted} />
            <Text className="font-sans-semibold text-xs uppercase tracking-wide text-on-surface-variant">
              Center
            </Text>
          </View>
          <Text className="font-sans text-sm text-on-surface-variant">{player.centerName}</Text>
        </View>
      </View>

      <View className="mt-4 rounded-lg bg-surface-container-low px-2 py-2">
        <VerifyPlayerRatingsRow
          batting={player.battingRating}
          bowling={player.bowlingRating}
          fielding={player.fieldingRating}
        />
      </View>

      {onViewProfile || (player.hasSkillVideo && onViewVideo) ? (
        <View className="mt-4 flex-row flex-wrap justify-end gap-2">
          {player.hasSkillVideo && onViewVideo ? (
            <Button
              variant="outline"
              label="View Video"
              onPress={onViewVideo}
              className="h-9 rounded-full border-primary px-4"
              textClassName="text-xs text-primary"
            />
          ) : null}
          {onViewProfile ? (
            <Button
              variant="amber"
              label="View Profile"
              onPress={onViewProfile}
              className="h-9 rounded-full px-4"
              textClassName="text-xs"
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
