import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { Button } from '../ui/Button';
import { Text } from '../ui/Text';
import { FIELD_ORANGE, INPUT_SHADOW_STYLE } from '../ui/fieldStyles';
import { SCORING_KEYPAD_GREY_BG } from './liveScoringKeypadTokens';

/** Off-the-bat runs on a no-ball (0 = plain Nb). */
export const NO_BALL_OFF_BAT_VALUES: readonly (readonly number[])[] = [
  [0, 1, 2],
  [3, 4, 6],
] as const;

/** Completed leg-bye / bye runs on a no-ball. */
export const NO_BALL_EXTRA_VALUES = [1, 2, 3, 4, 6] as const;

export type NoBallBranch = 'OFF_BAT' | 'LEG_BYE' | 'BYE';

export type NoBallSelection =
  | { branch: 'OFF_BAT'; runsBat: number }
  | { branch: 'LEG_BYE'; legByeRuns: number }
  | { branch: 'BYE'; byeRuns: number };

type Step = 'main' | 'leg-byes' | 'byes';

export interface NoBallDialogProps {
  visible: boolean;
  onCancel: () => void;
  onSelect: (selection: NoBallSelection) => void;
}

function formatOffBatLabel(runsBat: number): string {
  return runsBat === 0 ? 'Nb' : `Nb+${runsBat}`;
}

function formatLegByeLabel(runs: number): string {
  return `${runs}L NB`;
}

function formatByeLabel(runs: number): string {
  return `${runs}B NB`;
}

function OptionButton({
  label,
  highlighted,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  highlighted?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      className={`min-h-12 flex-1 items-center justify-center rounded-control active:opacity-80 ${
        highlighted
          ? 'border-2 border-primary bg-primary-container'
          : SCORING_KEYPAD_GREY_BG
      }`}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Text className="font-sans-bold text-xl text-on-surface">{label}</Text>
    </Pressable>
  );
}

function BranchButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      className={`min-h-11 flex-1 items-center justify-center rounded-control px-2 active:opacity-80 ${
        selected ? 'border-2 border-primary bg-primary-container' : `${SCORING_KEYPAD_GREY_BG} border border-transparent`
      }`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text className="text-center font-sans-semibold text-sm text-on-surface">{label}</Text>
    </Pressable>
  );
}

/** No-ball picker — off-the-bat, leg-byes, or byes branches (§12.1). */
export function NoBallDialog({
  visible,
  onCancel,
  onSelect,
}: NoBallDialogProps): React.ReactElement {
  const [step, setStep] = useState<Step>('main');

  useEffect(() => {
    if (!visible) {
      setStep('main');
    }
  }, [visible]);

  function close(): void {
    onCancel();
  }

  function pickOffBat(runsBat: number): void {
    onSelect({ branch: 'OFF_BAT', runsBat });
  }

  function pickLegBye(legByeRuns: number): void {
    onSelect({ branch: 'LEG_BYE', legByeRuns });
  }

  function pickBye(byeRuns: number): void {
    onSelect({ branch: 'BYE', byeRuns });
  }

  const showBack = step !== 'main';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable className="flex-1 items-center justify-center bg-black/40 px-4" onPress={close}>
        <Pressable
          className="w-full max-w-sm overflow-hidden rounded-control bg-surface"
          style={INPUT_SHADOW_STYLE}
          onPress={(event) => event.stopPropagation()}
        >
          <View className="flex-row items-center gap-2 border-b border-outline-variant px-4 py-3">
            {showBack ? (
              <Pressable
                onPress={() => setStep('main')}
                className="h-9 w-9 items-center justify-center rounded-full active:bg-black/5"
                accessibilityRole="button"
                accessibilityLabel="Back"
              >
                <Ionicons name="arrow-back" size={22} color={FIELD_ORANGE} />
              </Pressable>
            ) : null}
            <Text className="min-w-0 flex-1 font-sans-bold text-lg text-on-surface">NO BALL</Text>
            <Pressable
              onPress={close}
              className="h-9 w-9 items-center justify-center rounded-full active:bg-black/5"
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={22} color={FIELD_ORANGE} />
            </Pressable>
          </View>

          <View className="gap-2 p-4">
            {step === 'main' ? (
              <>
                {NO_BALL_OFF_BAT_VALUES.map((row) => (
                  <View key={row.join(',')} className="flex-row gap-2">
                    {row.map((runsBat) => (
                      <OptionButton
                        key={runsBat}
                        label={formatOffBatLabel(runsBat)}
                        highlighted={runsBat === 0}
                        accessibilityLabel={formatOffBatLabel(runsBat)}
                        onPress={() => pickOffBat(runsBat)}
                      />
                    ))}
                  </View>
                ))}

                <View className="mt-1 flex-row gap-2">
                  <BranchButton
                    label="Leg Byes"
                    selected={false}
                    onPress={() => setStep('leg-byes')}
                  />
                  <BranchButton label="Byes" selected={false} onPress={() => setStep('byes')} />
                </View>
              </>
            ) : null}

            {step === 'leg-byes' ? (
              <>
                <View className="flex-row gap-2">
                  <BranchButton label="Leg Byes" selected onPress={() => setStep('leg-byes')} />
                  <BranchButton label="Byes" selected={false} onPress={() => setStep('byes')} />
                </View>
                <View className="flex-row flex-wrap gap-2">
                  {NO_BALL_EXTRA_VALUES.map((runs) => (
                    <Pressable
                      key={runs}
                      onPress={() => pickLegBye(runs)}
                      className={`min-h-12 min-w-[30%] flex-1 items-center justify-center rounded-control ${SCORING_KEYPAD_GREY_BG} active:opacity-80`}
                      accessibilityRole="button"
                      accessibilityLabel={formatLegByeLabel(runs)}
                    >
                      <Text className="font-sans-bold text-lg text-on-surface">
                        {formatLegByeLabel(runs)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}

            {step === 'byes' ? (
              <>
                <View className="flex-row gap-2">
                  <BranchButton
                    label="Leg Byes"
                    selected={false}
                    onPress={() => setStep('leg-byes')}
                  />
                  <BranchButton label="Byes" selected onPress={() => setStep('byes')} />
                </View>
                <View className="flex-row flex-wrap gap-2">
                  {NO_BALL_EXTRA_VALUES.map((runs) => (
                    <Pressable
                      key={runs}
                      onPress={() => pickBye(runs)}
                      className={`min-h-12 min-w-[30%] flex-1 items-center justify-center rounded-control ${SCORING_KEYPAD_GREY_BG} active:opacity-80`}
                      accessibilityRole="button"
                      accessibilityLabel={formatByeLabel(runs)}
                    >
                      <Text className="font-sans-bold text-lg text-on-surface">
                        {formatByeLabel(runs)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}

            <Button label="Cancel" variant="outline" onPress={close} className="mt-2 h-11" />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
