import { Ionicons } from '@expo/vector-icons';
import {
  BattingStyle,
  BATTING_HAND_LABELS,
  type AddExternalBatsmanRequest,
} from '@acc/types';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { Button } from '../ui/Button';
import { KeyboardAwareFormScrollView } from '../ui/KeyboardAwareFormScrollView';
import { Select } from '../ui/Select';
import { Text } from '../ui/Text';
import { TextInput } from '../ui/TextInput';
import { FIELD_ORANGE, INPUT_SHADOW_STYLE } from '../ui/fieldStyles';
import { ApiRequestError, addExternalBatsman } from '../../lib/api';

export interface AddExternalBatsmanDialogProps {
  visible: boolean;
  matchId: string;
  inningsId: string;
  onCancel: () => void;
  onAdded: () => void;
}

const HAND_OPTIONS = [
  { value: BattingStyle.RHB, label: BATTING_HAND_LABELS[BattingStyle.RHB] },
  { value: BattingStyle.LHB, label: BATTING_HAND_LABELS[BattingStyle.LHB] },
] as const;

/** §9.5: name-only add for the unregistered external opponent (not registered-player search). */
export function AddExternalBatsmanDialog({
  visible,
  matchId,
  inningsId,
  onCancel,
  onAdded,
}: AddExternalBatsmanDialogProps): React.ReactElement {
  const [name, setName] = useState('');
  const [battingStyle, setBattingStyle] = useState<BattingStyle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function reset(): void {
    setName('');
    setBattingStyle(null);
    setError(null);
  }

  function handleCancel(): void {
    reset();
    onCancel();
  }

  async function handleAdd(): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Enter the batsman name.');
      return;
    }
    setSaving(true);
    setError(null);
    const body: AddExternalBatsmanRequest = {
      name: trimmed,
      ...(battingStyle ? { battingStyle } : {}),
    };
    try {
      await addExternalBatsman(matchId, inningsId, body);
      reset();
      onAdded();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not add batsman.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <Pressable className="flex-1 items-center justify-center bg-on-surface/40 px-4" onPress={handleCancel}>
        <Pressable
          className="w-full max-w-md overflow-hidden rounded-control bg-background"
          style={INPUT_SHADOW_STYLE}
          onPress={(event) => event.stopPropagation()}
        >
          <View className="flex-row items-center justify-between border-b border-outline-variant p-4">
            <Text className="font-sans-bold text-lg text-on-surface">Add New Batsman</Text>
            <Pressable onPress={handleCancel} className="rounded-full p-2 active:bg-surface-container-low">
              <Ionicons name="close" size={22} color={FIELD_ORANGE} />
            </Pressable>
          </View>

          <KeyboardAwareFormScrollView compact contentContainerClassName="gap-4 p-4" keyboardVerticalOffset={64}>
            <TextInput
              label="Batsman Name"
              placeholder="Enter full name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              error={error ?? undefined}
            />
            <Select
              label="Batting Hand (optional)"
              placeholder="Select hand"
              options={HAND_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              value={battingStyle}
              onChange={(value) => setBattingStyle(value as BattingStyle)}
            />
            <Text className="font-sans text-xs text-on-surface-variant">
              External opponent batters are match-only participants — not linked to app accounts.
            </Text>
          </KeyboardAwareFormScrollView>

          <View className="flex-row gap-3 border-t border-outline-variant bg-surface-container-low p-4">
            <Button variant="outline" label="Cancel" onPress={handleCancel} className="h-11 flex-1" />
            <Button
              label="Add"
              onPress={() => void handleAdd()}
              disabled={saving}
              className="h-11 flex-1"
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
