import { Ionicons } from '@expo/vector-icons';
import {
  DEFAULT_OVERLAY_THEME,
  OVERLAY_THEME_CATALOG,
  type OverlayThemeKey,
} from '@acc/types';
import { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { updateMatchOverlayTheme } from '../../../lib/api';
import { Button } from '../../ui/Button';
import { Select } from '../../ui/Select';
import { Text } from '../../ui/Text';
import { FIELD_ORANGE, INPUT_SHADOW_STYLE } from '../../ui/fieldStyles';

export interface CockpitSettingsModalProps {
  visible: boolean;
  matchId: string;
  overlayTheme: OverlayThemeKey;
  onClose: () => void;
  onThemeSaved: (overlayTheme: OverlayThemeKey) => void;
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
  overlayTheme,
  onClose,
  onThemeSaved,
}: CockpitSettingsModalProps): React.ReactElement {
  const [selectedTheme, setSelectedTheme] = useState<OverlayThemeKey>(
    overlayTheme ?? DEFAULT_OVERLAY_THEME,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setSelectedTheme(overlayTheme ?? DEFAULT_OVERLAY_THEME);
      setError(null);
    }
  }, [visible, overlayTheme]);

  const themeOptions = OVERLAY_THEME_CATALOG.map((entry) => ({
    value: entry.key,
    label: entry.label,
  }));

  const dirty = selectedTheme !== (overlayTheme ?? DEFAULT_OVERLAY_THEME);

  async function handleSave(): Promise<void> {
    if (!dirty || saving) {
      onClose();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await updateMatchOverlayTheme(matchId, { overlayTheme: selectedTheme });
      onThemeSaved(updated.overlayTheme);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save overlay theme.');
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
            <Select
              label="Overlay Theme"
              value={selectedTheme}
              options={themeOptions}
              onChange={(value) => setSelectedTheme(value as OverlayThemeKey)}
              disabled={saving}
            />
            <Text className="font-sans text-xs text-on-surface-variant">
              Per-match broadcast overlay look. The overlay page for this match uses the selected
              theme.
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
