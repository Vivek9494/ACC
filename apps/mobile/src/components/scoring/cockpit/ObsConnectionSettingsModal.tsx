import { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { Button } from '../../ui/Button';
import { Text } from '../../ui/Text';
import { TextInput } from '../../ui/TextInput';
import { KeyboardAwareFormScrollView } from '../../ui/KeyboardAwareFormScrollView';
import type { AscObsBridge, AscObsConfig } from '../../../types/asc-broadcast';

const EMPTY_CONFIG: AscObsConfig = {
  host: '127.0.0.1',
  port: 4455,
  password: '',
  obsAppPath: '/Applications/OBS.app',
  sceneCollection: '',
  profile: '',
  liveSceneName: 'Scene',
  replaySceneName: 'Replay',
  replayMediaSourceName: 'Replay Media',
  overlaySceneName: 'Scene',
  overlayUrlBase: 'https://acc-overlay.netlify.app',
};

export function ObsConnectionSettingsModal({
  visible,
  bridge,
  onClose,
}: {
  visible: boolean;
  bridge: AscObsBridge;
  onClose: () => void;
}): React.ReactElement {
  const [form, setForm] = useState<AscObsConfig>(EMPTY_CONFIG);
  const [portText, setPortText] = useState(String(EMPTY_CONFIG.port));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      return;
    }
    let cancelled = false;
    setError(null);
    void bridge.getConfig().then((config) => {
      if (cancelled) {
        return;
      }
      setForm(config);
      setPortText(String(config.port));
    });
    return () => {
      cancelled = true;
    };
  }, [visible, bridge]);

  const setField = <K extends keyof AscObsConfig>(key: K, value: AscObsConfig[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await bridge.saveConfig({
        ...form,
        port: Number.parseInt(portText, 10) || form.port,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save OBS settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        className="flex-1 items-center justify-center bg-black/40 px-4"
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close settings"
      >
        <Pressable
          className="max-h-[90%] w-full max-w-lg overflow-hidden rounded-control border border-outline-variant bg-surface"
          onPress={(e) => e.stopPropagation()}
        >
          <View className="border-b border-outline-variant px-4 py-3">
            <Text className="font-sans-bold text-base text-on-surface">OBS connection</Text>
            <Text className="mt-1 font-sans text-[12px] text-on-surface-variant">
              obs-websocket v5. Stored only on this Mac (same file as before).
            </Text>
          </View>
          <KeyboardAwareFormScrollView
            compact
            style={{ maxHeight: 480 }}
            extraBottomPadding={16}
            contentContainerClassName="px-5 py-4"
            footer={
              <View className="flex-row items-center justify-end gap-3 border-t border-outline-variant bg-surface px-5 py-4">
                <Button
                  label="Cancel"
                  variant="secondary"
                  onPress={onClose}
                  disabled={saving}
                  className="h-11 min-w-[96px] px-5"
                />
                <Button
                  label={saving ? 'Saving…' : 'Save'}
                  onPress={() => void onSave()}
                  disabled={saving}
                  className="h-11 min-w-[96px] px-5"
                />
              </View>
            }
          >
            {/*
              Web KeyboardAwareFormScrollView wraps children in one View, so
              contentContainer gap does not separate fields. Gap here is the
              between-group rhythm; TextInput keeps within-group label→input (mb-2).
            */}
            <View className="gap-5">
              <TextInput
                label="Host"
                value={form.host}
                onChangeText={(v) => setField('host', v)}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TextInput
                label="Port"
                value={portText}
                onChangeText={setPortText}
                keyboardType="number-pad"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TextInput
                label="Password"
                value={form.password}
                onChangeText={(v) => setField('password', v)}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TextInput
                label="OBS app path"
                value={form.obsAppPath}
                onChangeText={(v) => setField('obsAppPath', v)}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TextInput
                label="Scene collection (optional)"
                value={form.sceneCollection}
                onChangeText={(v) => setField('sceneCollection', v)}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Leave blank for OBS default"
              />
              <TextInput
                label="Profile (optional)"
                value={form.profile}
                onChangeText={(v) => setField('profile', v)}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Leave blank for OBS default"
              />
              <TextInput
                label="Live scene"
                value={form.liveSceneName}
                onChangeText={(v) => setField('liveSceneName', v)}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TextInput
                label="OBS Scene (overlay)"
                value={form.overlaySceneName}
                onChangeText={(v) => setField('overlaySceneName', v)}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TextInput
                label="Overlay URL base"
                value={form.overlayUrlBase}
                onChangeText={(v) => setField('overlayUrlBase', v)}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="https://acc-overlay.netlify.app"
              />
              <TextInput
                label="Replay scene"
                value={form.replaySceneName}
                onChangeText={(v) => setField('replaySceneName', v)}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TextInput
                label="Replay media source"
                value={form.replayMediaSourceName}
                onChangeText={(v) => setField('replayMediaSourceName', v)}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {error ? (
                <Text className="font-sans text-[12px] text-primary">{error}</Text>
              ) : null}
            </View>
          </KeyboardAwareFormScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
