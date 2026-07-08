import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import type { BowlerPickerPlayerRow } from '@acc/types';
import { Pressable, View } from 'react-native';

import { PlayerAvatar } from '../tournament/PlayerAvatar';
import { Card } from '../ui/Card';
import { Text } from '../ui/Text';
import { FIELD_ORANGE } from '../ui/fieldStyles';
import { colors } from '@/theme/colors';

function typeAndFiguresLine(row: BowlerPickerPlayerRow): string {
  if (row.figuresOmRw) {
    return `${row.bowlingTypeLabel} • ${row.figuresOmRw}`;
  }
  return row.bowlingTypeLabel;
}

function SelectionIndicator({
  selected,
  selectable,
}: {
  selected: boolean;
  selectable: boolean;
}): React.ReactElement {
  if (selected) {
    return (
      <View className="rounded-full bg-primary-container p-1.5">
        <MaterialIcons name="sports-cricket" size={20} color={FIELD_ORANGE} />
      </View>
    );
  }
  if (selectable) {
    return <Ionicons name="add-circle-outline" size={28} color={colors.textMuted} />;
  }
  return <View className="h-7 w-7" />;
}

export interface BowlerPickerRowProps {
  row: BowlerPickerPlayerRow;
  selectedBowlerId?: string | null;
  onPress: (userId: string) => void;
  onEdit?: (row: BowlerPickerPlayerRow) => void;
}

export function BowlerPickerRow({
  row,
  selectedBowlerId = null,
  onPress,
  onEdit,
}: BowlerPickerRowProps): React.ReactElement {
  const disabled = !row.selectable;
  const selected =
    row.userId === selectedBowlerId || (row.selected && row.selectable);
  const highlighted = selected;
  const showEdit = row.isExternal && onEdit != null;

  return (
    <Card
      onPress={disabled ? undefined : () => onPress(row.userId)}
      disabled={disabled}
      className={[
        'flex-row items-center gap-3 rounded-control',
        highlighted ? 'border-2 border-primary bg-primary-container' : 'border border-outline-variant',
        disabled ? 'opacity-50' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <PlayerAvatar
        firstName={row.firstName}
        profilePhotoUrl={row.profilePhotoUrl}
        size="md"
        highlighted={highlighted}
      />
      <View className="min-w-0 flex-1">
        <Text className="font-sans-bold text-base text-on-surface">
          {row.firstName} {row.lastName}
        </Text>
        <Text className="mt-0.5 font-sans text-sm text-on-surface-variant">
          {typeAndFiguresLine(row)}
        </Text>
        {disabled && row.ineligibilityHint ? (
          <Text className="mt-0.5 font-sans-semibold text-xs text-primary">
            {row.ineligibilityHint}
          </Text>
        ) : null}
      </View>
      <View className="shrink-0 flex-row items-center gap-1">
        {showEdit ? (
          <Pressable
            onPress={() => onEdit(row)}
            accessibilityRole="button"
            accessibilityLabel="Edit player name"
            className="h-10 w-10 items-center justify-center active:opacity-70"
          >
            <MaterialIcons name="edit" size={22} color={FIELD_ORANGE} />
          </Pressable>
        ) : null}
        <SelectionIndicator selected={selected} selectable={row.selectable} />
      </View>
    </Card>
  );
}
