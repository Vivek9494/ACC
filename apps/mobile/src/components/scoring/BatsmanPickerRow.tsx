import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import {
  BATTING_HAND_LABELS,
  type BattingStyle,
  type BatsmanPickerPlayerRow,
  BatsmanPickerStatus,
} from '@acc/types';
import { Pressable, View } from 'react-native';

import { PlayerAvatar } from '../tournament/PlayerAvatar';
import { Card } from '../ui/Card';
import { Text } from '../ui/Text';
import { FIELD_ORANGE } from '../ui/fieldStyles';

function handLabel(battingStyle: string | null): string {
  if (battingStyle === 'RHB' || battingStyle === 'LHB') {
    return BATTING_HAND_LABELS[battingStyle as BattingStyle];
  }
  return 'Batsman';
}

function statusLine(row: BatsmanPickerPlayerRow): string {
  if (row.status === BatsmanPickerStatus.Out && row.dismissalText) {
    return row.dismissalText;
  }
  if (row.status === BatsmanPickerStatus.RetiredHurt && row.dismissalText) {
    return row.dismissalText;
  }
  return handLabel(row.battingStyle);
}

function SelectionIndicator({ selected }: { selected: boolean }): React.ReactElement {
  if (selected) {
    return (
      <View className="rounded-full bg-primary-container p-1">
        <Ionicons name="checkmark-circle" size={20} color={FIELD_ORANGE} />
      </View>
    );
  }
  return <View className="h-6 w-6 rounded-full border-2 border-outline-variant" />;
}

export interface BatsmanPickerRowProps {
  row: BatsmanPickerPlayerRow;
  onPress: (userId: string) => void;
  onEdit?: (row: BatsmanPickerPlayerRow) => void;
}

export function BatsmanPickerRow({ row, onPress, onEdit }: BatsmanPickerRowProps): React.ReactElement {
  const disabled = !row.selectable;
  const highlighted = row.selected && row.selectable;
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
        {row.status === BatsmanPickerStatus.AtCrease && row.runs !== null && row.balls !== null ? (
          <Text className="mt-0.5 font-sans text-sm text-on-surface-variant">
            {handLabel(row.battingStyle)} •{' '}
            <Text className="font-sans-semibold text-primary">
              {row.runs} ({row.balls})
            </Text>
          </Text>
        ) : (
          <Text className="mt-0.5 font-sans text-sm text-on-surface-variant">{statusLine(row)}</Text>
        )}
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
        <SelectionIndicator selected={row.selected} />
      </View>
    </Card>
  );
}
