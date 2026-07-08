import { Platform, Share } from 'react-native';

/** Copy plain text to the clipboard; falls back to the share sheet when clipboard is unavailable. */
export async function copyTextToClipboard(value: string): Promise<void> {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(value);
    return;
  }

  try {
    const { setStringAsync } = await import('expo-clipboard');
    await setStringAsync(value);
  } catch {
    await Share.share({ message: value });
  }
}
