import { Ionicons } from '@expo/vector-icons';
import { parseYoutubeVideoId } from '@acc/types';
import { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { updateMatchYoutubeUrl } from '../../../lib/api';
import { Button } from '../../ui/Button';
import { Text } from '../../ui/Text';
import { TextInput } from '../../ui/TextInput';
import { FIELD_ORANGE, INPUT_SHADOW_STYLE } from '../../ui/fieldStyles';

export interface CockpitSettingsModalProps {
  visible: boolean;
  matchId: string;
  youtubeUrl: string | null;
  onClose: () => void;
  onYoutubeUrlSaved: (youtubeUrl: string | null) => void;
}

/** Header gear — matches ScreenHeader back arrow size/colour. */
export function CockpitSettingsHeaderButton({
  onPress,
}: {
  onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      className="h-9 w-9 shrink-0 items-center justify-center rounded-full active:bg-black/5 web:hover:bg-black/5"
      accessibilityRole="button"
      accessibilityLabel="Settings"
    >
      <Ionicons name="settings-outline" size={24} color={FIELD_ORANGE} />
    </Pressable>
  );
}

export function CockpitSettingsModal({
  visible,
  matchId,
  youtubeUrl,
  onClose,
  onYoutubeUrlSaved,
}: CockpitSettingsModalProps): React.ReactElement {
  const [youtubeInput, setYoutubeInput] = useState(youtubeUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [youtubeError, setYoutubeError] = useState<string | undefined>();

  useEffect(() => {
    if (visible) {
      setYoutubeInput(youtubeUrl ?? '');
      setError(null);
      setYoutubeError(undefined);
    }
  }, [visible, youtubeUrl]);

  const normalizedYoutube = youtubeInput.trim();
  const savedYoutube = youtubeUrl?.trim() ?? '';
  const dirty = normalizedYoutube !== savedYoutube;

  function validateYoutubeInput(value: string): string | undefined {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    if (parseYoutubeVideoId(trimmed) == null) {
      return 'Enter a valid YouTube watch, youtu.be, or live URL';
    }
    return undefined;
  }

  function onYoutubeChange(text: string): void {
    setYoutubeInput(text);
    if (youtubeError !== undefined) {
      setYoutubeError(validateYoutubeInput(text));
    }
  }

  async function handleSave(): Promise<void> {
    if (!dirty) {
      onClose();
      return;
    }

    const nextYoutubeError = validateYoutubeInput(youtubeInput);
    if (nextYoutubeError) {
      setYoutubeError(nextYoutubeError);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const updated = await updateMatchYoutubeUrl(matchId, {
        youtubeUrl: normalizedYoutube.length > 0 ? normalizedYoutube : null,
      });
      onYoutubeUrlSaved(updated.youtubeUrl);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 items-center justify-center bg-black/40 px-4" onPress={onClose}>
        <Pressable
          className="w-full max-w-sm overflow-hidden rounded-control bg-surface"
          style={INPUT_SHADOW_STYLE}
          onPress={(event) => event.stopPropagation()}
        >
          <View className="flex-row items-center justify-between border-b border-outline-variant px-4 py-3">
            <Text className="font-sans-bold text-lg text-on-surface">Settings</Text>
            <Pressable
              onPress={onClose}
              className="h-9 w-9 items-center justify-center rounded-full active:bg-black/5 web:hover:bg-black/5"
              accessibilityRole="button"
              accessibilityLabel="Close settings"
            >
              <Ionicons name="close" size={22} color={FIELD_ORANGE} />
            </Pressable>
          </View>

          <View className="gap-4 p-4">
            <TextInput
              label="YouTube Live URL"
              value={youtubeInput}
              onChangeText={onYoutubeChange}
              placeholder="https://youtube.com/watch?v=… or youtu.be/…"
              autoCapitalize="none"
              autoCorrect={false}
              error={youtubeError}
              editable={!saving}
            />
            <Text className="font-sans text-xs text-on-surface-variant">
              Main Scoreboard panel embeds this stream (muted autoplay). Expect ~10–30s broadcast
              delay vs live scoring. Saved per match.
            </Text>

            {error ? (
              <Text className="font-sans text-sm text-primary">{error}</Text>
            ) : null}
            <View className="flex-row gap-2">
              <Button label="Cancel" variant="outline" onPress={onClose} className="h-11 flex-1" />
              <Button
                label={saving ? 'Saving…' : dirty ? 'Save' : 'Close'}
                onPress={() => void handleSave()}
                disabled={saving}
                className="h-11 flex-1"
              />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
