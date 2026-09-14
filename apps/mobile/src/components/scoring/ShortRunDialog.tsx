import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { Button } from '../ui/Button';
import { Text } from '../ui/Text';
import { FIELD_ORANGE, INPUT_SHADOW_STYLE } from '../ui/fieldStyles';
import { SCORING_KEYPAD_GREY_BG } from './liveScoringKeypadTokens';

/** Physical runs completed before short-run deduction (1–6). */
export const SHORT_RUN_ATTEMPTED: readonly (readonly number[])[] = [
  [1, 2, 3],
  [4, 5, 6],
] as const;

export interface ShortRunSelection {
  /** Crossings completed before the umpire deducted short run(s). */
  runsRun: number;
  /** How many of those crossings were short. */
  runsShort: number;
}

export interface ShortRunDialogProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: (selection: ShortRunSelection) => void;
}

/**
 * Short-run scorer input (Laws): enter physical runs run, then how many were
 * short. Credited = runsRun − runsShort; strike follows runsRun.
 */
export function ShortRunDialog({
  visible,
  onCancel,
  onConfirm,
}: ShortRunDialogProps): React.ReactElement {
  const [runsRun, setRunsRun] = useState<number | null>(null);

  useEffect(() => {
    if (!visible) {
      setRunsRun(null);
    }
  }, [visible]);

  function shortOptions(attempted: number): number[] {
    // At least one short; at most all attempted (credit 0).
    return Array.from({ length: attempted }, (_, i) => i + 1);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable className="flex-1 items-center justify-center bg-black/40 px-4" onPress={onCancel}>
        <Pressable
          className="w-full max-w-sm overflow-hidden rounded-control bg-surface"
          style={INPUT_SHADOW_STYLE}
          onPress={(event) => event.stopPropagation()}
        >
          <View className="flex-row items-center justify-between border-b border-outline-variant px-4 py-3">
            <Text className="font-sans-bold text-lg text-on-surface">
              {runsRun == null ? 'SHORT RUN — RUNS RUN' : 'SHORT RUN — HOW MANY SHORT'}
            </Text>
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
            {runsRun == null ? (
              <>
                <Text className="mb-1 font-sans text-sm text-on-surface-variant">
                  How many runs did the batters complete before the short was signalled?
                </Text>
                {SHORT_RUN_ATTEMPTED.map((row) => (
                  <View key={row.join(',')} className="flex-row gap-2">
                    {row.map((value) => (
                      <Pressable
                        key={value}
                        onPress={() => setRunsRun(value)}
                        className={`min-h-12 flex-1 items-center justify-center rounded-control ${SCORING_KEYPAD_GREY_BG} active:opacity-80`}
                        accessibilityRole="button"
                        accessibilityLabel={`Ran ${value}`}
                      >
                        <Text className="font-sans-bold text-xl text-on-surface">{value}</Text>
                      </Pressable>
                    ))}
                  </View>
                ))}
              </>
            ) : (
              <>
                <Text className="mb-1 font-sans text-sm text-on-surface-variant">
                  Ran {runsRun}. How many were short? (Credits {runsRun} minus shorts; strike follows{' '}
                  {runsRun}.)
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {shortOptions(runsRun).map((short) => (
                    <Pressable
                      key={short}
                      onPress={() => onConfirm({ runsRun, runsShort: short })}
                      className={`min-h-12 min-w-[28%] flex-1 items-center justify-center rounded-control ${SCORING_KEYPAD_GREY_BG} active:opacity-80`}
                      accessibilityRole="button"
                      accessibilityLabel={`${short} short — credit ${runsRun - short}`}
                    >
                      <Text className="font-sans-bold text-lg text-on-surface">
                        {short} short
                      </Text>
                      <Text className="font-sans text-xs text-on-surface-variant">
                        credit {runsRun - short}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Button
                  label="Back"
                  variant="outline"
                  onPress={() => setRunsRun(null)}
                  className="mt-2 h-11"
                />
              </>
            )}

            <Button label="Cancel" variant="outline" onPress={onCancel} className="mt-1 h-11" />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
