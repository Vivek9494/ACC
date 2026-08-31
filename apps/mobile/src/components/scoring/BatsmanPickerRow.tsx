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

/**
 * Row + optional edit control are siblings (not nested buttons). Card is a non-pressable
 * shell so react-native-web does not nest &lt;button&gt; inside &lt;button&gt;.
 */
export function BatsmanPickerRow({ row, onPress, onEdit }: BatsmanPickerRowProps): React.ReactElement {
  const disabled = !row.selectable;
  const highlighted = row.selected && row.selectable;
  const showEdit = row.isExternal && onEdit != null;

  return (
    <Card
      className={[
        'flex-row items-center gap-3 rounded-control',
        highlighted ? 'border-2 border-primary bg-primary-container' : 'border border-outline-variant',
        disabled ? 'opacity-50' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Pressable
        onPress={disabled ? undefined : () => onPress(row.userId)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`Select ${row.firstName} ${row.lastName}`}
        className="min-w-0 flex-1 flex-row items-center gap-3 active:opacity-90"
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
        <SelectionIndicator selected={row.selected} />
      </Pressable>
      {showEdit ? (
        <Pressable
          onPress={() => onEdit(row)}
          accessibilityRole="button"
          accessibilityLabel="Edit player name"
          className="h-10 w-10 shrink-0 items-center justify-center active:opacity-70"
        >
          <MaterialIcons name="edit" size={22} color={FIELD_ORANGE} />
        </Pressable>
      ) : null}
    </Card>
  );
}
