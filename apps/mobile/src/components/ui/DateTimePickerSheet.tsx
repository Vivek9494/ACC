import DateTimePicker from '@react-native-community/datetimepicker';
import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from './Text';

/** UIDatePicker spinner needs explicit height or it may not lay out / receive events. */
const IOS_SPINNER_HEIGHT = 216;

// Always pass explicit, wide bounds. The native module defaults an unset
// minimum/maximumDate to 0 (1970). Under the New Architecture a recycled
// UIDatePicker keeps the *previous* picker's bounds, so when a date picker
// (with a real maximumDate) is recycled into a time picker (no maximumDate),
// the prop diff fires and clamps maximumDate to 1970 — pinning the time to
// epoch 0 (which displays as 7:00 PM local). Wide defaults prevent the clamp.
const WIDE_MIN_DATE = new Date(1900, 0, 1);
const WIDE_MAX_DATE = new Date(2200, 0, 1);

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
  // Controlled draft: the spinner's `value` must follow the user's scroll, or a
  // Fabric (New Architecture) UIDatePicker re-asserts the prop date and snaps back.
  const [draft, setDraft] = useState(value);
  // Latest `value` without retriggering the seed effect when the parent passes a
  // fresh Date reference on every render.
  const valueRef = useRef(value);
  valueRef.current = value;

  // Seed the draft only when the sheet opens — never mid-scroll.
  useEffect(() => {
    if (visible) {
      setDraft(valueRef.current);
    }
  }, [visible]);

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
            <Pressable onPress={() => onConfirm(draft)} hitSlop={8} accessibilityRole="button">
              <Text className="font-sans-semibold text-base text-primary">Done</Text>
            </Pressable>
          </View>
          <DateTimePicker
            value={draft}
            mode={mode}
            display="spinner"
            minimumDate={minimumDate ?? WIDE_MIN_DATE}
            maximumDate={maximumDate ?? WIDE_MAX_DATE}
            style={{ height: IOS_SPINNER_HEIGHT }}
            onChange={(event, selected) => {
              if (event.type === 'dismissed' || !selected) {
                return;
              }
              setDraft(selected);
            }}
          />
          <SafeAreaView edges={['bottom']} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
