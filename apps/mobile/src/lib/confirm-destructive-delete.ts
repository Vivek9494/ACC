import { Alert } from 'react-native';

export interface ConfirmDestructiveDeleteOptions {
  title: string;
  message: string;
  onConfirm: () => void | Promise<void>;
}

/** Native iOS/Android destructive delete confirmation — grouped Cancel + red Delete. */
export function confirmDestructiveDeleteAlert({
  title,
  message,
  onConfirm,
}: ConfirmDestructiveDeleteOptions): void {
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
