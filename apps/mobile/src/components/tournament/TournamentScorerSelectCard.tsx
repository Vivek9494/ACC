import { registrationPlayerRoleLabel, type TournamentScorerPoolRow } from '@acc/types';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { colors } from '@/theme/colors';

import { PlayerAvatar } from './PlayerAvatar';
import { Text } from '../ui/Text';

export interface TournamentScorerSelectCardProps {
  player: TournamentScorerPoolRow;
  selected: boolean;
  disabled?: boolean;
  onToggle: () => void;
}

/** Registered player row for the tennis tournament scorer picker. */
export function TournamentScorerSelectCard({
  player,
  selected,
  disabled = false,
  onToggle,
}: TournamentScorerSelectCardProps): React.ReactElement {
  const roleLabel = registrationPlayerRoleLabel(player.playerRole);

  return (
    <Pressable
      onPress={disabled ? undefined : onToggle}
      disabled={disabled}
      className="overflow-hidden rounded-control border border-outline-variant/30 bg-surface-container-lowest p-4 active:opacity-90"
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled }}
    >
      <View className="flex-row items-center gap-3">
        <PlayerAvatar
          firstName={player.firstName}
          profilePhotoUrl={player.profilePhotoUrl}
          size="sm"
          shape="circle"
        />
        <View className="min-w-0 flex-1">
          <Text className="font-sans-bold text-base text-on-surface">
            {player.firstName} {player.lastName}
          </Text>
          <Text className="mt-1 font-sans text-sm text-on-surface-variant">{player.centerName}</Text>
          {roleLabel ? (
            <Text className="mt-1 font-sans-medium text-xs uppercase tracking-wider text-primary">
              {roleLabel}
            </Text>
          ) : null}
        </View>
        <View
          className={`h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
            selected ? 'border-primary bg-primary' : 'border-stone-300 bg-surface'
          } ${disabled ? 'opacity-50' : ''}`}
        >
          {selected ? <Ionicons name="checkmark" size={14} color={colors.textInverse} /> : null}
        </View>
      </View>
    </Pressable>
  );
}
