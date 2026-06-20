import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, View } from 'react-native';

import { Button } from '../ui/Button';
import { Text } from '../ui/Text';

export interface EditPunchTimeDialogProps {
  visible: boolean;
  title: string;
  initialValue: Date;
  onClose: () => void;
  onSave: (punchTimeUtc: string) => Promise<void>;
  onRevoke?: () => Promise<void>;
  working?: boolean;
}

/** Captain edit / manual-enter arrival time dialog. */
export function EditPunchTimeDialog({
  visible,
  title,
  initialValue,
  onClose,
  onSave,
  onRevoke,
  working = false,
}: EditPunchTimeDialogProps): React.ReactElement {
  const [selected, setSelected] = useState(initialValue);
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);

  useEffect(() => {
    if (visible) {
      setSelected(initialValue);
    }
  }, [visible, initialValue]);

  function onPickerChange(event: DateTimePickerEvent, date?: Date): void {
    if (Platform.OS === 'android') {
      setShowAndroidPicker(false);
    }
    if (event.type === 'dismissed' || !date) {
      return;
    }
    setSelected(date);
  }

  async function handleSave(): Promise<void> {
    await onSave(selected.toISOString());
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <Pressable className="gap-4 rounded-t-2xl bg-background p-6" onPress={() => undefined}>
          <Text className="font-sans-bold text-lg text-on-surface">{title}</Text>

          {Platform.OS === 'ios' ? (
            <DateTimePicker
              value={selected}
              mode="datetime"
              display="spinner"
              onChange={onPickerChange}
            />
          ) : (
            <>
              <Pressable
                onPress={() => setShowAndroidPicker(true)}
                className="rounded-control border border-outline-variant bg-surface px-4 py-3"
              >
                <Text className="font-sans text-base text-on-surface">
                  {selected.toLocaleString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </Text>
              </Pressable>
              {showAndroidPicker ? (
                <DateTimePicker
                  value={selected}
                  mode="datetime"
                  onChange={onPickerChange}
                />
              ) : null}
            </>
          )}

          <View className="gap-2">
            <Button
              label={working ? 'Saving…' : 'Save'}
              disabled={working}
              onPress={() => void handleSave()}
              className="h-12 w-full"
            />
            {onRevoke ? (
              <Button
                label={working ? '…' : 'Clear Arrival'}
                variant="destructive"
                disabled={working}
                onPress={() => void onRevoke()}
                className="h-12 w-full"
              />
            ) : null}
            <Button
              label="Cancel"
              variant="outline"
              disabled={working}
              onPress={onClose}
              className="h-12 w-full"
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
