import { Alert, Platform } from 'react-native';

export interface ConfirmActionAlertOptions {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
}

/** Confirmation dialog — native Alert on iOS/Android; `window.confirm` on web. */
export function confirmActionAlert({
  title,
  message,
  confirmLabel,
  onConfirm,
}: ConfirmActionAlertOptions): void {
  if (Platform.OS === 'web') {
    const ok =
      typeof window !== 'undefined' &&
      window.confirm(`${title}\n\n${message}`);
    if (ok) {
      void Promise.resolve(onConfirm());
    }
    return;
  }

  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    {
      text: confirmLabel,
      style: 'default',
      onPress: () => {
        void Promise.resolve(onConfirm());
      },
    },
  ]);
}
