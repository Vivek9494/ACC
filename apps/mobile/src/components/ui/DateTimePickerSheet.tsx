import DateTimePicker from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from './Text';

export interface DateTimePickerSheetProps {
  visible: boolean;
  mode: 'date' | 'time';
  value: Date;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
  minimumDate?: Date;
  maximumDate?: Date;
}

/** iOS-only bottom sheet for spinner date/time pickers — floats above fixed footers. */
export function DateTimePickerSheet({
  visible,
  mode,
  value,
  onConfirm,
  onCancel,
  minimumDate,
  maximumDate,
}: DateTimePickerSheetProps): React.ReactElement | null {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (visible) {
      setDraft(value);
    }
  }, [visible, value]);

  if (Platform.OS !== 'ios') {
    return null;
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onCancel}>
        <Pressable className="rounded-t-xl bg-surface" onPress={() => {}}>
          <View className="flex-row items-center justify-between border-b border-outline-variant/20 px-4 py-3">
            <Pressable onPress={onCancel} hitSlop={8} accessibilityRole="button">
              <Text className="font-sans text-base text-on-surface-variant">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => onConfirm(draft)}
              hitSlop={8}
              accessibilityRole="button"
            >
              <Text className="font-sans-semibold text-base text-primary">Done</Text>
            </Pressable>
          </View>
          <DateTimePicker
            value={draft}
            mode={mode}
            display="spinner"
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            onChange={(_, selected) => {
              if (selected) {
                setDraft(selected);
              }
            }}
          />
          <SafeAreaView edges={['bottom']} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
