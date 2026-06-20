import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, View } from 'react-native';

import { Button } from '../ui/Button';
import { Text } from '../ui/Text';
import { FIELD_ORANGE, INPUT_SHADOW_STYLE } from '../ui/fieldStyles';
import { SCORING_KEYPAD_GREY_BG } from './liveScoringKeypadTokens';

/** Leg-bye run options shown in the 3×2 grid (1 LB … 6 LB). */
export const LEG_BYE_VALUES: readonly (readonly number[])[] = [
  [1, 2, 3],
  [4, 5, 6],
] as const;

export interface LegByesDialogProps {
  visible: boolean;
  onCancel: () => void;
  onSelect: (runs: number) => void;
}

function formatLegByeLabel(value: number): string {
  return `${value} LB`;
}

/** Leg-bye run picker (§12.1) — extras to the team, legal ball, not off the bat. */
export function LegByesDialog({
  visible,
  onCancel,
  onSelect,
}: LegByesDialogProps): React.ReactElement {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable className="flex-1 items-center justify-center bg-black/40 px-4" onPress={onCancel}>
        <Pressable
          className="w-full max-w-sm overflow-hidden rounded-control bg-surface"
          style={INPUT_SHADOW_STYLE}
          onPress={(event) => event.stopPropagation()}
        >
          <View className="flex-row items-center justify-between border-b border-outline-variant px-4 py-3">
            <Text className="font-sans-bold text-lg text-on-surface">LEG BYES</Text>
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
            {LEG_BYE_VALUES.map((row) => (
              <View key={row.join(',')} className="flex-row gap-2">
                {row.map((value) => (
                  <Pressable
                    key={value}
                    onPress={() => onSelect(value)}
                    className={`min-h-12 flex-1 items-center justify-center rounded-control ${SCORING_KEYPAD_GREY_BG} active:opacity-80`}
                    accessibilityRole="button"
                    accessibilityLabel={`Leg byes ${formatLegByeLabel(value)}`}
                  >
                    <Text className="font-sans-bold text-xl text-on-surface">
                      {formatLegByeLabel(value)}
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
