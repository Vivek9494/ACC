import { useEffect, useState } from 'react';
import {
  Dimensions,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
  type KeyboardEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '../ui/Button';
import { Text } from '../ui/Text';
import { TextInput } from '../ui/TextInput';
import { INPUT_SHADOW_STYLE } from '../ui/fieldStyles';
import { ApiRequestError, renameExternalPlayer } from '../../lib/api';

const TOP_SHEET_MARGIN = 16;

export interface EditExternalPlayerNameDialogProps {
  visible: boolean;
  matchId: string;
  playerId: string | null;
  initialName: string;
  onCancel: () => void;
  onSaved: () => void;
}

/** §9.5: rename a name-only external opponent player during live scoring. */
export function EditExternalPlayerNameDialog({
  visible,
  matchId,
  playerId,
  initialName,
  onCancel,
  onSaved,
}: EditExternalPlayerNameDialogProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (visible) {
      setName(initialName);
      setError(null);
    }
  }, [visible, initialName]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (event: KeyboardEvent): void => {
      setKeyboardHeight(event.endCoordinates.height);
    };
    const onHide = (): void => {
      setKeyboardHeight(0);
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  function handleCancel(): void {
    Keyboard.dismiss();
    setError(null);
    onCancel();
  }

  async function handleSave(): Promise<void> {
    if (!playerId) {
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Enter the player name.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await renameExternalPlayer(matchId, playerId, trimmed);
      Keyboard.dismiss();
      onSaved();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not save name.');
    } finally {
      setSaving(false);
    }
  }

  const bottomInset =
    keyboardHeight > 0 ? keyboardHeight : Math.max(insets.bottom, 16);
  const maxSheetHeight =
    Dimensions.get('window').height -
    insets.top -
    TOP_SHEET_MARGIN -
    bottomInset -
    TOP_SHEET_MARGIN;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <Pressable
        className="flex-1 justify-end bg-on-surface/40 px-4"
        style={{
          paddingTop: insets.top + TOP_SHEET_MARGIN,
          paddingBottom: bottomInset,
        }}
        onPress={handleCancel}
      >
        <Pressable
          className="w-full max-w-md self-center overflow-hidden rounded-control bg-background"
          style={[INPUT_SHADOW_STYLE, { maxHeight: Math.max(maxSheetHeight, 220) }]}
          onPress={(event) => event.stopPropagation()}
        >
          <View className="border-b border-outline-variant p-4">
            <Text className="font-sans-bold text-lg text-on-surface">Edit Player Name</Text>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerClassName="gap-4 p-4"
            bounces={false}
          >
            <TextInput
              label="Player Name"
              placeholder="Enter full name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              error={error ?? undefined}
            />
            <Text className="font-sans text-xs text-on-surface-variant">
              Corrects the name everywhere in this match (scorecard, bowling card, etc.).
            </Text>
          </ScrollView>

          <View className="flex-row gap-3 border-t border-outline-variant bg-surface-container-low p-4">
            <Button variant="outline" label="Cancel" onPress={handleCancel} className="h-11 flex-1" />
            <Button
              label="Save"
              onPress={() => void handleSave()}
              disabled={saving}
              className="h-11 flex-1"
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
