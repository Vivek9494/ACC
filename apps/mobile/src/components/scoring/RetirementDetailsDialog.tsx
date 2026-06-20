import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { SCORING_KEYPAD_GREY_BG } from './liveScoringKeypadTokens';
import { Button } from '../ui/Button';
import { Text } from '../ui/Text';
import { FIELD_ORANGE, INPUT_SHADOW_STYLE } from '../ui/fieldStyles';

export type RetirementType = 'HURT' | 'OUT';

export interface RetirementDetailsConfirm {
  retiredHurt: boolean;
  batsmanId: string;
}

export interface RetirementDetailsDialogProps {
  visible: boolean;
  strikerId: string | null;
  nonStrikerId: string | null;
  nameOf: (id: string | null | undefined) => string;
  onClose: () => void;
  onBack: () => void;
  onConfirm: (result: RetirementDetailsConfirm) => void;
}

function RetirementTypeToggle({
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
      className={[
        'min-h-12 flex-1 items-center justify-center rounded-control active:opacity-80',
        selected ? 'border-2 border-primary bg-primary-container' : `${SCORING_KEYPAD_GREY_BG} border border-transparent`,
      ].join(' ')}
      accessibilityRole="button"
    >
      <Text className="text-center font-sans-semibold text-sm text-on-surface">{label}</Text>
    </Pressable>
  );
}

function BatsmanRow({
  label,
  sublabel,
  selected,
  onPress,
}: {
  label: string;
  sublabel: string;
  selected: boolean;
  onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      className={[
        'flex-row items-center justify-between rounded-control border px-3 py-2.5 active:opacity-80',
        selected ? 'border-2 border-primary bg-primary-container' : 'border border-outline-variant bg-surface',
      ].join(' ')}
      accessibilityRole="button"
    >
      <View className="min-w-0 flex-1 pr-2">
        <Text className="font-sans-semibold text-sm text-on-surface">{label}</Text>
        <Text className="font-sans text-xs text-on-surface-variant">{sublabel}</Text>
      </View>
      {selected ? <Ionicons name="checkmark-circle" size={22} color={FIELD_ORANGE} /> : null}
    </Pressable>
  );
}

/** Retired hurt vs retired out — administrative non-ball event (§12.1). */
export function RetirementDetailsDialog({
  visible,
  strikerId,
  nonStrikerId,
  nameOf,
  onClose,
  onBack,
  onConfirm,
}: RetirementDetailsDialogProps): React.ReactElement {
  const [retirementType, setRetirementType] = useState<RetirementType | null>(null);
  const [batsmanId, setBatsmanId] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setRetirementType(null);
      setBatsmanId(null);
    }
  }, [visible]);

  const canConfirm = retirementType !== null && batsmanId !== null;

  function handleConfirm(): void {
    if (!retirementType || !batsmanId) return;
    onConfirm({
      retiredHurt: retirementType === 'HURT',
      batsmanId,
    });
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 items-center justify-center bg-black/40 px-4" onPress={onClose}>
        <Pressable
          className="max-h-[85%] w-full max-w-sm overflow-hidden rounded-control bg-surface"
          style={INPUT_SHADOW_STYLE}
          onPress={(event) => event.stopPropagation()}
        >
          <View className="flex-row items-center justify-between border-b border-outline-variant px-4 py-3">
            <Text className="font-sans-bold text-lg text-on-surface">Retirement Details</Text>
            <Pressable
              onPress={onClose}
              className="h-9 w-9 items-center justify-center rounded-full active:bg-black/5"
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={22} color={FIELD_ORANGE} />
            </Pressable>
          </View>

          <ScrollView
            className="max-h-80"
            contentContainerClassName="gap-4 p-4"
            keyboardShouldPersistTaps="handled"
          >
            <View className="gap-2">
              <Text className="font-sans-semibold text-xs uppercase tracking-wider text-on-surface-variant">
                Retirement type
              </Text>
              <View className="flex-row gap-2">
                <RetirementTypeToggle
                  label="Retired Hurt"
                  selected={retirementType === 'HURT'}
                  onPress={() => setRetirementType('HURT')}
                />
                <RetirementTypeToggle
                  label="Retired Out"
                  selected={retirementType === 'OUT'}
                  onPress={() => setRetirementType('OUT')}
                />
              </View>
              {retirementType === 'HURT' ? (
                <Text className="font-sans text-xs text-on-surface-variant">
                  Not a wicket — the batter may return later with their score preserved.
                </Text>
              ) : retirementType === 'OUT' ? (
                <Text className="font-sans text-xs text-on-surface-variant">
                  Counts as a wicket — the batter cannot return.
                </Text>
              ) : null}
            </View>

            <View className="gap-2">
              <Text className="font-sans-semibold text-xs uppercase tracking-wider text-on-surface-variant">
                Select batsman
              </Text>
              {strikerId ? (
                <BatsmanRow
                  label={nameOf(strikerId)}
                  sublabel="On strike"
                  selected={batsmanId === strikerId}
                  onPress={() => setBatsmanId(strikerId)}
                />
              ) : null}
              {nonStrikerId ? (
                <BatsmanRow
                  label={nameOf(nonStrikerId)}
                  sublabel="Non-striker"
                  selected={batsmanId === nonStrikerId}
                  onPress={() => setBatsmanId(nonStrikerId)}
                />
              ) : null}
            </View>
          </ScrollView>

          <View className="flex-row gap-3 border-t border-outline-variant p-4">
            <Button label="Back" variant="outline" onPress={onBack} className="h-11 flex-1" />
            <Button
              label="Confirm"
              onPress={handleConfirm}
              disabled={!canConfirm}
              className="h-11 flex-1"
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
