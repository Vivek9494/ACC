import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { Button } from '../ui/Button';
import { Text } from '../ui/Text';
import { TextInput } from '../ui/TextInput';
import { FIELD_ORANGE, INPUT_SHADOW_STYLE } from '../ui/fieldStyles';

export interface EndInningsConfirmDialogProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function EndInningsConfirmDialog({
  visible,
  onCancel,
  onConfirm,
}: EndInningsConfirmDialogProps): React.ReactElement {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable className="flex-1 items-center justify-center bg-black/40 px-4" onPress={onCancel}>
        <Pressable
          className="w-full max-w-sm overflow-hidden rounded-control bg-surface"
          style={INPUT_SHADOW_STYLE}
          onPress={(event) => event.stopPropagation()}
        >
          <View className="border-b border-outline-variant px-4 py-3">
            <Text className="font-sans-bold text-lg text-on-surface">End Inning?</Text>
          </View>
          <View className="gap-3 p-4">
            <Text className="font-sans text-sm text-on-surface">
              Are you sure you want to end this inning? This action cannot be undone.
            </Text>
            <View className="gap-2">
              <Button label="End Inning" onPress={onConfirm} className="h-11" />
              <Button label="Cancel" variant="outline" onPress={onCancel} className="h-11" />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export interface ChangeTargetBlockedDialogProps {
  visible: boolean;
  onClose: () => void;
}

/** Shown when Change Target is tapped before the chase innings has begun (§12.2). */
export function ChangeTargetBlockedDialog({
  visible,
  onClose,
}: ChangeTargetBlockedDialogProps): React.ReactElement {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 items-center justify-center bg-black/40 px-4" onPress={onClose}>
        <Pressable
          className="w-full max-w-sm overflow-hidden rounded-control bg-surface"
          style={INPUT_SHADOW_STYLE}
          onPress={(event) => event.stopPropagation()}
        >
          <View className="border-b border-outline-variant px-4 py-3">
            <Text className="font-sans-bold text-lg text-on-surface">Change Target</Text>
          </View>
          <View className="gap-3 p-4">
            <Text className="font-sans text-sm text-on-surface">
              Target can only be changed during the second innings. The first innings is still in
              progress.
            </Text>
            <Button label="OK" onPress={onClose} className="h-11" />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export interface ChangeTargetDialogProps {
  visible: boolean;
  currentTarget: number | null;
  onCancel: () => void;
  onConfirm: (target: number) => void;
}

export function ChangeTargetDialog({
  visible,
  currentTarget,
  onCancel,
  onConfirm,
}: ChangeTargetDialogProps): React.ReactElement {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (visible) {
      setValue(currentTarget != null ? String(currentTarget) : '');
    }
  }, [visible, currentTarget]);

  const parsed = Number.parseInt(value, 10);
  const valid = Number.isFinite(parsed) && parsed >= 1;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable className="flex-1 items-center justify-center bg-black/40 px-4" onPress={onCancel}>
        <Pressable
          className="w-full max-w-sm overflow-hidden rounded-control bg-surface"
          style={INPUT_SHADOW_STYLE}
          onPress={(event) => event.stopPropagation()}
        >
          <View className="flex-row items-center justify-between border-b border-outline-variant px-4 py-3">
            <Text className="font-sans-bold text-lg text-on-surface">Change Target</Text>
            <Pressable onPress={onCancel} className="h-9 w-9 items-center justify-center rounded-full active:bg-black/5">
              <Ionicons name="close" size={22} color={FIELD_ORANGE} />
            </Pressable>
          </View>
          <View className="gap-3 p-4">
            <TextInput
              label="Revised target (runs to win)"
              value={value}
              onChangeText={setValue}
              keyboardType="number-pad"
              placeholder={currentTarget != null ? String(currentTarget) : 'e.g. 145'}
            />
            <View className="flex-row gap-2">
              <Button label="Cancel" variant="outline" onPress={onCancel} className="h-11 flex-1" />
              <Button
                label="Save"
                disabled={!valid}
                onPress={() => {
                  if (valid) onConfirm(parsed);
                }}
                className="h-11 flex-1"
              />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export interface ChangeOversDialogProps {
  visible: boolean;
  currentOvers: number | null;
  minOversBowled: number;
  onBack: () => void;
  onConfirm: (overs: number) => void;
}

export function ChangeOversDialog({
  visible,
  currentOvers,
  minOversBowled,
  onBack,
  onConfirm,
}: ChangeOversDialogProps): React.ReactElement {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (visible) {
      setValue(currentOvers != null ? String(currentOvers) : '');
    }
  }, [visible, currentOvers]);

  const parsed = Number.parseInt(value, 10);
  const isPositiveInt = Number.isFinite(parsed) && parsed >= 1;
  const belowBowled = isPositiveInt && parsed < minOversBowled;
  const valid = isPositiveInt && !belowBowled;
  const oversError = belowBowled
    ? `Total overs cannot be less than overs already bowled (${minOversBowled}).`
    : undefined;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onBack}>
      <Pressable className="flex-1 items-center justify-center bg-black/40 px-4" onPress={onBack}>
        <Pressable
          className="w-full max-w-sm overflow-hidden rounded-control bg-surface"
          style={INPUT_SHADOW_STYLE}
          onPress={(event) => event.stopPropagation()}
        >
          <View className="flex-row items-center gap-2 border-b border-outline-variant px-4 py-3">
            <Pressable
              onPress={onBack}
              className="h-9 w-9 items-center justify-center rounded-full active:bg-black/5"
              accessibilityRole="button"
              accessibilityLabel="Back to More Options"
            >
              <Ionicons name="arrow-back" size={22} color={FIELD_ORANGE} />
            </Pressable>
            <Text className="min-w-0 flex-1 font-sans-bold text-lg text-on-surface">Change Overs</Text>
          </View>
          <View className="gap-3 p-4">
            <TextInput
              label="Enter Overs"
              labelVariant="brand"
              value={value}
              onChangeText={setValue}
              keyboardType="number-pad"
              placeholder="e.g. 20"
              error={oversError}
            />
            <View className="gap-2">
              <Button
                label="Confirm"
                disabled={!valid}
                onPress={() => {
                  if (valid) onConfirm(parsed);
                }}
                className="h-11"
              />
              <Button label="Cancel" variant="outline" onPress={onBack} className="h-11" />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
