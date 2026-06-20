import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { Button } from '../ui/Button';
import { Text } from '../ui/Text';
import { FIELD_ORANGE, INPUT_SHADOW_STYLE } from '../ui/fieldStyles';
import { colors } from '@/theme/colors';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export type MoreOptionsAction = 'END_INNINGS' | 'PENALTY' | 'CHANGE_TARGET' | 'CHANGE_OVERS';

export interface MoreOptionsModalProps {
  visible: boolean;
  onCancel: () => void;
  onSelect: (action: MoreOptionsAction) => void;
}

const ROWS: readonly { action: MoreOptionsAction; label: string; icon: IoniconName }[] = [
  { action: 'END_INNINGS', label: 'End Inning', icon: 'flag-outline' },
  { action: 'PENALTY', label: 'Penalty', icon: 'warning-outline' },
  { action: 'CHANGE_TARGET', label: 'Change Target', icon: 'locate-outline' },
  { action: 'CHANGE_OVERS', label: 'Change Overs', icon: 'time-outline' },
] as const;

function OptionRow({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: IoniconName;
  onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-control border border-outline-variant px-3 py-3 active:bg-black/5"
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={22} color={FIELD_ORANGE} />
      <Text className="flex-1 font-sans-semibold text-base text-on-surface">{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

/** Scorer "More" menu — innings admin actions (§12.2). */
export function MoreOptionsModal({
  visible,
  onCancel,
  onSelect,
}: MoreOptionsModalProps): React.ReactElement {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable className="flex-1 items-center justify-center bg-black/40 px-4" onPress={onCancel}>
        <Pressable
          className="w-full max-w-sm overflow-hidden rounded-control bg-surface"
          style={INPUT_SHADOW_STYLE}
          onPress={(event) => event.stopPropagation()}
        >
          <View className="flex-row items-center justify-between border-b border-outline-variant px-4 py-3">
            <Text className="font-sans-bold text-lg text-on-surface">More Options</Text>
            <Pressable
              onPress={onCancel}
              className="h-9 w-9 items-center justify-center rounded-full active:bg-black/5"
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={22} color={FIELD_ORANGE} />
            </Pressable>
          </View>

          <View className="gap-2 p-4">
            {ROWS.map((row) => (
              <OptionRow
                key={row.action}
                label={row.label}
                icon={row.icon}
                onPress={() => onSelect(row.action)}
              />
            ))}
            <Button label="Cancel" variant="outline" onPress={onCancel} className="mt-2 h-11" />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
