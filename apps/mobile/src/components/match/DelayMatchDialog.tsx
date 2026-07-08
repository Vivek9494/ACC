import { MATCH_DELAY_DURATION_OPTIONS } from '@acc/types';
import { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { INPUT_SHADOW_STYLE } from '../ui/fieldStyles';
import { Text } from '../ui/Text';

export interface DelayMatchDialogProps {
  visible: boolean;
  working?: boolean;
  onClose: () => void;
  onApply: (delayMinutes: number) => Promise<void>;
}

/** Pre-live delay duration picker (§5.2). */
export function DelayMatchDialog({
  visible,
  working = false,
  onClose,
  onApply,
}: DelayMatchDialogProps): React.ReactElement {
  const [selectedMinutes, setSelectedMinutes] = useState<number | null>(null);

  useEffect(() => {
    if (visible) {
      setSelectedMinutes(null);
    }
  }, [visible]);

  const options = MATCH_DELAY_DURATION_OPTIONS.map((option) => ({
    value: String(option.value),
    label: option.label,
  }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <Pressable
          className="gap-4 rounded-t-2xl bg-background p-6"
          style={INPUT_SHADOW_STYLE}
          onPress={() => undefined}
        >
          <Text className="font-sans-bold text-lg text-on-surface">Delay Match</Text>
          <Text className="font-sans text-sm text-on-surface-variant">
            Add to the cumulative delay. The original start time is preserved.
          </Text>
          <Select
            label="Delayed By"
            placeholder="Select duration"
            value={selectedMinutes != null ? String(selectedMinutes) : null}
            options={options}
            onChange={(value) => setSelectedMinutes(Number(value))}
          />
          <View className="flex-row gap-3">
            <Button
              label="Cancel"
              variant="outline"
              className="h-12 min-w-0 flex-1"
              disabled={working}
              onPress={onClose}
            />
            <Button
              label="Apply"
              className="h-12 min-w-0 flex-1"
              disabled={working || selectedMinutes == null}
              onPress={() => void onApply(selectedMinutes!)}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
