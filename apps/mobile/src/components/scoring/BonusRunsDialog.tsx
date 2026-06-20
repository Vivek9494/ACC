import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, View } from 'react-native';

import { Button } from '../ui/Button';
import { Text } from '../ui/Text';
import { FIELD_ORANGE, INPUT_SHADOW_STYLE } from '../ui/fieldStyles';
import { SCORING_KEYPAD_GREY_BG } from './liveScoringKeypadTokens';

/** Bonus adjustment values shown in the 3×4 grid (+1…+6, -1…-6). */
export const BONUS_RUN_VALUES: readonly (readonly number[])[] = [
  [1, 2, 3],
  [4, 5, 6],
  [-1, -2, -3],
  [-4, -5, -6],
] as const;

export interface BonusRunsDialogProps {
  visible: boolean;
  onCancel: () => void;
  onSelect: (runs: number) => void;
}

function formatBonusLabel(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

/** Team-only bonus/penalty adjustment picker (§12.1 penalty runs). */
export function BonusRunsDialog({
  visible,
  onCancel,
  onSelect,
}: BonusRunsDialogProps): React.ReactElement {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable className="flex-1 items-center justify-center bg-black/40 px-4" onPress={onCancel}>
        <Pressable
          className="w-full max-w-sm overflow-hidden rounded-control bg-surface"
          style={INPUT_SHADOW_STYLE}
          onPress={(event) => event.stopPropagation()}
        >
          <View className="flex-row items-center justify-between border-b border-outline-variant px-4 py-3">
            <Text className="font-sans-bold text-lg text-on-surface">Bonus Runs</Text>
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
            {BONUS_RUN_VALUES.map((row) => (
              <View key={row.join(',')} className="flex-row gap-2">
                {row.map((value) => (
                  <Pressable
                    key={value}
                    onPress={() => onSelect(value)}
                    className={`min-h-12 flex-1 items-center justify-center rounded-control ${SCORING_KEYPAD_GREY_BG} active:opacity-80`}
                    accessibilityRole="button"
                    accessibilityLabel={`Bonus runs ${formatBonusLabel(value)}`}
                  >
                    <Text className="font-sans-bold text-xl text-on-surface">
                      {formatBonusLabel(value)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ))}

            <Button label="Cancel" variant="outline" onPress={onCancel} className="mt-2 h-11" />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
