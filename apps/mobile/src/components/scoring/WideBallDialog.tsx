import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, View } from 'react-native';

import { Button } from '../ui/Button';
import { Text } from '../ui/Text';
import { FIELD_ORANGE, INPUT_SHADOW_STYLE } from '../ui/fieldStyles';
import { SCORING_KEYPAD_GREY_BG } from './liveScoringKeypadTokens';

/**
 * Runs physically completed in addition to the 1-run wide penalty.
 * Row layout matches the scorer keypad dialog (§12.1).
 */
export const WIDE_BALL_RAN_VALUES: readonly (readonly number[])[] = [
  [0, 1, 2],
  [3, 4, 6],
] as const;

export interface WideBallDialogProps {
  visible: boolean;
  onCancel: () => void;
  /** @param ranPortion Runs completed beyond the automatic 1-run wide penalty (0 = plain Wd). */
  onSelect: (ranPortion: number) => void;
}

function formatWideLabel(ranPortion: number): string {
  return ranPortion === 0 ? 'Wd' : `Wd + ${ranPortion}`;
}

/** Wide delivery picker — penalty + optional completed runs (§12.1). */
export function WideBallDialog({
  visible,
  onCancel,
  onSelect,
}: WideBallDialogProps): React.ReactElement {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable className="flex-1 items-center justify-center bg-black/40 px-4" onPress={onCancel}>
        <Pressable
          className="w-full max-w-sm overflow-hidden rounded-control bg-surface"
          style={INPUT_SHADOW_STYLE}
          onPress={(event) => event.stopPropagation()}
        >
          <View className="flex-row items-center justify-between border-b border-outline-variant px-4 py-3">
            <Text className="font-sans-bold text-lg text-on-surface">WIDE BALL</Text>
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
            {WIDE_BALL_RAN_VALUES.map((row) => (
              <View key={row.join(',')} className="flex-row gap-2">
                {row.map((ranPortion) => {
                  const isDefaultWide = ranPortion === 0;
                  return (
                    <Pressable
                      key={ranPortion}
                      onPress={() => onSelect(ranPortion)}
                      className={`min-h-12 flex-1 items-center justify-center rounded-control active:opacity-80 ${
                        isDefaultWide
                          ? 'border-2 border-primary bg-primary-container'
                          : SCORING_KEYPAD_GREY_BG
                      }`}
                      accessibilityRole="button"
                      accessibilityLabel={formatWideLabel(ranPortion)}
                    >
                      <Text className="font-sans-bold text-xl text-on-surface">
                        {formatWideLabel(ranPortion)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}

            <Button label="Cancel" variant="outline" onPress={onCancel} className="mt-2 h-11" />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
