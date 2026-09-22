import { Ionicons } from '@expo/vector-icons';
import type { TeamSummary } from '@acc/types';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { FIELD_ORANGE } from '../ui/fieldStyles';
import { OverflowMenu, type OverflowMenuAction } from '../ui/OverflowMenu';
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

/** Tappable team row — logo/avatar, name, member count; overflow Edit / Delete when permitted. */
export function TeamListItem({
  team,
  onPress,
  onEdit,
  onDelete,
}: TeamListItemProps): React.ReactElement {
  const menuActions = useMemo((): OverflowMenuAction[] => {
    const actions: OverflowMenuAction[] = [];
    if (onEdit) {
      actions.push({
        key: 'edit',
        label: 'Edit',
        icon: 'pencil',
        secondary: true,
        onPress: onEdit,
      });
    }
    if (onDelete) {
      actions.push({
        key: 'delete',
        label: 'Delete',
        icon: 'trash-outline',
        destructive: true,
        onPress: onDelete,
      });
    }
    return actions;
  }, [onDelete, onEdit]);

  const showActions = menuActions.length > 0;

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
        <OverflowMenu
          actions={menuActions}
          accessibilityLabel={`More options for ${team.name}`}
          iconColor={FIELD_ORANGE}
        />
      ) : null}
    </View>
  );
}
