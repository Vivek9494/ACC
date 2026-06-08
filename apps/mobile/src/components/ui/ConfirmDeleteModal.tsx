import { Modal, Pressable, View } from 'react-native';

import { Button } from './Button';
import { Text } from './Text';

export interface ConfirmDeleteModalProps {
  visible: boolean;
  title: string;
  message: string;
  errorMessage?: string | null;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Confirmation dialog for destructive actions; surfaces backend errors inline. */
export function ConfirmDeleteModal({
  visible,
  title,
  message,
  errorMessage,
  loading = false,
  onCancel,
  onConfirm,
}: ConfirmDeleteModalProps): React.ReactElement {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable className="flex-1 justify-center bg-black/40 px-6" onPress={onCancel}>
        <Pressable
          className="rounded-xl bg-white p-5"
          onPress={(event) => event.stopPropagation()}
        >
          <Text className="font-sans-bold text-lg text-on-surface">{title}</Text>
          <Text className="mt-2 font-sans text-sm leading-5 text-on-surface-variant">{message}</Text>
          {errorMessage ? (
            <View className="mt-3 rounded-xl border border-[#c1121f]/30 bg-[#fff5f5] p-3">
              <Text className="font-sans text-sm text-[#c1121f]">{errorMessage}</Text>
            </View>
          ) : null}
          <View className="mt-5 flex-row gap-3">
            <View className="flex-1">
              <Button variant="outline" label="Cancel" onPress={onCancel} disabled={loading} />
            </View>
            <View className="flex-1">
              <Button
                variant="destructive"
                label={loading ? 'Deleting…' : 'Delete'}
                onPress={onConfirm}
                disabled={loading}
              />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
