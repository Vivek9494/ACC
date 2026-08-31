import { Pressable } from 'react-native';

import { copyTextToClipboard } from '../../../lib/copy-text';
import { overlayObsBrowserSourceUrl } from '../../../lib/overlay-url';
import { Text } from '../../ui/Text';

export function ObsOverlayLinkButton({
  matchId,
  onCopied,
}: {
  matchId: string;
  onCopied: (url: string, copied: boolean) => void;
}): React.ReactElement {
  const url = overlayObsBrowserSourceUrl(matchId);

  async function handlePress(): Promise<void> {
    try {
      await copyTextToClipboard(url);
      onCopied(url, true);
    } catch {
      onCopied(url, false);
    }
  }

  return (
    <Pressable
      onPress={() => void handlePress()}
      accessibilityRole="button"
      accessibilityLabel="Copy OBS overlay link"
      className="rounded border border-outline-variant bg-surface px-1.5 py-0.5 active:bg-surface-container-low web:hover:bg-surface-container-low"
    >
      <Text className="font-sans-bold text-[8px] uppercase tracking-wide text-on-surface-variant">
        OBS Overlay Link
      </Text>
    </Pressable>
  );
}
