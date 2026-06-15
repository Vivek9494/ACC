import { Ionicons } from '@expo/vector-icons';
import type { TeamSummary } from '@acc/types';
import { Image, Pressable, View } from 'react-native';

import { TeamAvatar } from '../ui/TeamAvatar';
import { FIELD_ORANGE } from '../ui/fieldStyles';
import { Text } from '../ui/Text';

function formatMemberCount(count: number): string {
  return `${count} Member${count === 1 ? '' : 's'}`;
}

export interface TeamListItemProps {
  team: TeamSummary;
  onPress: () => void;
}

/** Tappable team row — logo/avatar, name, member count, chevron. */
export function TeamListItem({ team, onPress }: TeamListItemProps): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-4 rounded-control bg-surface-container-low p-4 active:opacity-80"
      accessibilityRole="button"
      accessibilityLabel={`${team.name}, ${formatMemberCount(team.memberCount)}`}
    >
      <TeamAvatar name={team.name} logoUrl={team.logoUrl} size="md" />
      <View className="min-w-0 flex-1">
        <Text className="font-sans-bold text-base text-on-surface">{team.name}</Text>
        <Text className="font-sans text-sm text-on-surface-variant">
          {formatMemberCount(team.memberCount)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={FIELD_ORANGE} />
    </Pressable>
  );
}
