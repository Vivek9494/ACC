import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { FIELD_ORANGE, INPUT_SHADOW_STYLE } from '@/components/ui/fieldStyles';
import { copyTextToClipboard } from '@/lib/copy-text';
import { Text } from '@/components/ui/Text';

export interface TemporaryPasswordDialogProps {
  visible: boolean;
  temporaryPassword: string;
  onDismiss: () => void;
}

/**
 * One-time admin dialog showing a generated temporary password. The value is
 * never retrievable after dismiss — copy is the admin's only chance to save it.
 */
export function TemporaryPasswordDialog({
  visible,
  temporaryPassword,
  onDismiss,
}: TemporaryPasswordDialogProps): React.ReactElement {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    await copyTextToClipboard(temporaryPassword);
    setCopied(true);
  }, [temporaryPassword]);

  const dismiss = useCallback(() => {
    setCopied(false);
    onDismiss();
  }, [onDismiss]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <Pressable
        className="flex-1 items-center justify-center bg-black/40 px-6"
        onPress={dismiss}
        accessibilityRole="button"
        accessibilityLabel="Close temporary password dialog"
      >
        <Pressable
          onPress={(event) => event.stopPropagation()}
          className="w-full max-w-sm gap-4 rounded-control bg-surface px-6 py-8"
          style={INPUT_SHADOW_STYLE}
        >
          <View className="items-center gap-3">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-primary-container">
              <Ionicons name="key-outline" size={36} color={FIELD_ORANGE} />
            </View>
            <Text className="text-center font-sans-bold text-xl text-on-surface">
              Temporary password
            </Text>
          </View>

          <View className="rounded-lg bg-background px-4 py-3">
            <Text
              className="text-center font-sans-semibold text-lg tracking-wide text-on-surface"
              selectable
            >
              {temporaryPassword}
            </Text>
          </View>

          <Text className="text-center font-sans text-sm text-on-surface-variant">
            Share it with the user. It won&apos;t be shown again.
          </Text>

          <Button
            onPress={() => void onCopy()}
            className="h-12"
            textClassName="font-sans-semibold text-sm"
            label={copied ? 'Copied' : 'Copy password'}
          />

          <Button
            onPress={dismiss}
            variant="outline"
            className="h-12"
            textClassName="font-sans-semibold text-sm"
            label="Done"
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
