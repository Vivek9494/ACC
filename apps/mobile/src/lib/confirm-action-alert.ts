import { Alert } from 'react-native';

export interface ConfirmActionAlertOptions {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
}

/** Native iOS/Android confirmation — grouped Cancel + neutral confirm action. */
export function confirmActionAlert({
  title,
  message,
  confirmLabel,
  onConfirm,
}: ConfirmActionAlertOptions): void {
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
