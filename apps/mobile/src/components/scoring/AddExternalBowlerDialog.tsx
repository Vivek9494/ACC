import { Ionicons } from '@expo/vector-icons';
import {
  BOWLING_TYPE_OPTIONS,
  BOWLING_TYPE_DISPLAY_LABELS,
  type AddExternalBowlerRequest,
  type BowlingTypeOption,
} from '@acc/types';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Text } from '../ui/Text';
import { TextInput } from '../ui/TextInput';
import { FIELD_ORANGE, INPUT_SHADOW_STYLE } from '../ui/fieldStyles';
import { ApiRequestError, addExternalBowler } from '../../lib/api';

export interface AddExternalBowlerDialogProps {
  visible: boolean;
  matchId: string;
  inningsId: string;
  onCancel: () => void;
  onAdded: () => void;
}

const TYPE_OPTIONS = BOWLING_TYPE_OPTIONS.map((value) => ({
  value,
  label: BOWLING_TYPE_DISPLAY_LABELS[value as BowlingTypeOption],
}));

/** §9.5: name-only add for the unregistered external opponent (not registered-player search). */
export function AddExternalBowlerDialog({
  visible,
  matchId,
  inningsId,
  onCancel,
  onAdded,
}: AddExternalBowlerDialogProps): React.ReactElement {
  const [name, setName] = useState('');
  const [bowlingType, setBowlingType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function reset(): void {
    setName('');
    setBowlingType(null);
    setError(null);
  }

  function handleCancel(): void {
    reset();
    onCancel();
  }

  async function handleAdd(): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Enter the bowler name.');
      return;
    }
    setSaving(true);
    setError(null);
    const body: AddExternalBowlerRequest = {
      name: trimmed,
      ...(bowlingType ? { bowlingType } : {}),
    };
    try {
      await addExternalBowler(matchId, inningsId, body);
      reset();
      onAdded();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not add bowler.');
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
            <Text className="font-sans-bold text-lg text-on-surface">Add New Bowler</Text>
            <Pressable onPress={handleCancel} className="rounded-full p-2 active:bg-surface-container-low">
              <Ionicons name="close" size={22} color={FIELD_ORANGE} />
            </Pressable>
          </View>

          <View className="gap-4 p-4">
            <TextInput
              label="Bowler Name"
              placeholder="Enter full name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              error={error ?? undefined}
            />
            <Select
              label="Bowling Type (optional)"
              placeholder="Select type"
              options={TYPE_OPTIONS}
              value={bowlingType}
              onChange={setBowlingType}
            />
            <Text className="font-sans text-xs text-on-surface-variant">
              External opponent bowlers are match-only participants — not linked to app accounts.
            </Text>
          </View>

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
