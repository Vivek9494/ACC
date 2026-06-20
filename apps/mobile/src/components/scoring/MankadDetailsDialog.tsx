import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { Button } from '../ui/Button';
import { Text } from '../ui/Text';
import { FIELD_ORANGE, INPUT_SHADOW_STYLE } from '../ui/fieldStyles';

export interface MankadDetailsConfirm {
  dismissedId: string;
}

export interface MankadDetailsDialogProps {
  visible: boolean;
  strikerId: string | null;
  nonStrikerId: string | null;
  nameOf: (id: string | null | undefined) => string;
  onClose: () => void;
  onBack: () => void;
  onConfirm: (result: MankadDetailsConfirm) => void;
}

function BatsmanRow({
  label,
  sublabel,
  selected,
  disabled = false,
  onPress,
}: {
  label: string;
  sublabel: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      className={[
        'flex-row items-center justify-between rounded-control border px-3 py-2.5',
        disabled ? 'opacity-50' : 'active:opacity-80',
        selected ? 'border-2 border-primary bg-primary-container' : 'border border-outline-variant bg-surface',
      ].join(' ')}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
    >
      <View className="min-w-0 flex-1 pr-2">
        <Text className="font-sans-semibold text-sm text-on-surface">{label}</Text>
        <Text className="font-sans text-xs text-on-surface-variant">{sublabel}</Text>
      </View>
      {selected ? <Ionicons name="checkmark-circle" size={22} color={FIELD_ORANGE} /> : null}
    </Pressable>
  );
}

/** Pre-delivery Mankad — non-striker run out by the bowler (§30.3, scored as RUN_OUT). */
export function MankadDetailsDialog({
  visible,
  strikerId,
  nonStrikerId,
  nameOf,
  onClose,
  onBack,
  onConfirm,
}: MankadDetailsDialogProps): React.ReactElement {
  const [dismissedId, setDismissedId] = useState<string | null>(nonStrikerId);

  useEffect(() => {
    if (visible) {
      setDismissedId(nonStrikerId);
    } else {
      setDismissedId(null);
    }
  }, [visible, nonStrikerId]);

  const canConfirm = dismissedId !== null && dismissedId === nonStrikerId;

  function handleConfirm(): void {
    if (!dismissedId || dismissedId !== nonStrikerId) return;
    onConfirm({ dismissedId });
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
            <Text className="font-sans-bold text-lg text-on-surface">SELECT THE OUT BATSMAN</Text>
            <Pressable
              onPress={onClose}
              className="h-9 w-9 items-center justify-center rounded-full active:bg-black/5"
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={22} color={FIELD_ORANGE} />
            </Pressable>
          </View>

          <ScrollView contentContainerClassName="gap-3 p-4" keyboardShouldPersistTaps="handled">
            <Text className="font-sans text-sm text-on-surface-variant">
              A Mankad dismisses the non-striker before the ball is bowled. The striker cannot be
              out this way.
            </Text>
            {strikerId ? (
              <BatsmanRow
                label={nameOf(strikerId)}
                sublabel="On strike — not eligible"
                selected={false}
                disabled
                onPress={() => undefined}
              />
            ) : null}
            {nonStrikerId ? (
              <BatsmanRow
                label={nameOf(nonStrikerId)}
                sublabel="Non-striker"
                selected={dismissedId === nonStrikerId}
                onPress={() => setDismissedId(nonStrikerId)}
              />
            ) : (
              <View className="rounded-control border border-outline-variant bg-surface p-4">
                <Text className="font-sans text-sm text-on-surface-variant">
                  No non-striker at the crease.
                </Text>
              </View>
            )}
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
