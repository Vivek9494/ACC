import { Ionicons } from '@expo/vector-icons';
import type { TeamSummary } from '@acc/types';
import { Pressable, View } from 'react-native';

import { FIELD_ORANGE } from '../ui/fieldStyles';
import { ListRowIconButton } from '../ui/ListRowIconButton';
import { TeamAvatar } from '../ui/TeamAvatar';
import { Text } from '../ui/Text';

function formatMemberCount(count: number): string {
  return `${count} Member${count === 1 ? '' : 's'}`;
}

export interface TeamListItemProps {
  team: TeamSummary;
  onPress: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

/** Tappable team row — logo/avatar, name, member count; optional edit/delete actions. */
export function TeamListItem({
  team,
  onPress,
  onEdit,
  onDelete,
}: TeamListItemProps): React.ReactElement {
  const showActions = onEdit != null || onDelete != null;

  return (
    <View className="flex-row items-center gap-2 rounded-control bg-surface-container-low p-4">
      <Pressable
        onPress={onPress}
        className="min-w-0 flex-1 flex-row items-center gap-4 active:opacity-80"
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
        {!showActions ? (
          <Ionicons name="chevron-forward" size={20} color={FIELD_ORANGE} />
        ) : null}
      </Pressable>
      {showActions ? (
        <View className="flex-row items-center gap-1">
          {onEdit ? (
            <ListRowIconButton
              icon="pencil"
              accessibilityLabel={`Edit ${team.name}`}
              onPress={onEdit}
            />
          ) : null}
          {onDelete ? (
            <ListRowIconButton
              icon="trash-outline"
              accessibilityLabel={`Delete ${team.name}`}
              onPress={onDelete}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
