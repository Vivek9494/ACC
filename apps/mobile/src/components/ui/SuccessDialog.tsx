import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { Button } from './Button';
import { FIELD_ORANGE, INPUT_SHADOW_STYLE } from './fieldStyles';
import { Text } from './Text';

export interface SuccessDialogProps {
  visible: boolean;
  title: string;
  message: string;
  /** Auto-dismiss after this many ms; defaults to 3000 when set. */
  autoDismissMs?: number;
  onDismiss: () => void;
  continueLabel?: string;
}

/**
 * Centered success modal with dimmed backdrop. Calls {@link onDismiss} once — either
 * after the auto-dismiss timer or when the user taps Continue / the card.
 */
export function SuccessDialog({
  visible,
  title,
  message,
  autoDismissMs = 3000,
  onDismiss,
  continueLabel = 'Continue',
}: SuccessDialogProps): React.ReactElement {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissedRef = useRef(false);

  const dismiss = useCallback(() => {
    if (dismissedRef.current) {
      return;
    }
    dismissedRef.current = true;
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    onDismiss();
  }, [onDismiss]);

  useEffect(() => {
    if (!visible) {
      dismissedRef.current = false;
      return;
    }

    if (autoDismissMs > 0) {
      timerRef.current = setTimeout(() => {
        dismiss();
      }, autoDismissMs);
    }

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [autoDismissMs, dismiss, visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <Pressable
        className="flex-1 items-center justify-center bg-black/40 px-6"
        onPress={dismiss}
        accessibilityRole="button"
        accessibilityLabel={continueLabel}
      >
        <Pressable
          onPress={dismiss}
          className="w-full max-w-sm items-center gap-4 rounded-control bg-white px-6 py-8"
          style={INPUT_SHADOW_STYLE}
        >
          <View className="h-14 w-14 items-center justify-center rounded-full bg-primary-container">
            <Ionicons name="checkmark-circle" size={40} color={FIELD_ORANGE} />
          </View>
          <Text className="text-center font-sans-bold text-xl text-on-surface">{title}</Text>
          <Text className="text-center font-sans text-base text-on-surface-variant">{message}</Text>
          <Button
            onPress={dismiss}
            className="mt-2 h-12 w-full"
            textClassName="font-sans-semibold text-sm"
            label={continueLabel}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
