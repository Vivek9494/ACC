import { Alert, Platform } from 'react-native';

export interface ConfirmDestructiveDeleteOptions {
  title: string;
  message: string;
  onConfirm: () => void | Promise<void>;
}

/** Destructive delete confirmation — native Alert on iOS/Android; `window.confirm` on web. */
export function confirmDestructiveDeleteAlert({
  title,
  message,
  onConfirm,
}: ConfirmDestructiveDeleteOptions): void {
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
      text: 'Delete',
      style: 'destructive',
      onPress: () => {
        void Promise.resolve(onConfirm());
      },
    },
  ]);
}
