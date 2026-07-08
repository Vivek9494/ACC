import type { TournamentScorerRow } from '@acc/types';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { ApiRequestError, swapMatchScorer } from '../../lib/api';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Text } from '../ui/Text';

export interface ChangeMatchScorerDialogProps {
  visible: boolean;
  matchId: string;
  pickableScorers: TournamentScorerRow[];
  currentScorerUserId: string | null;
  onClose: () => void;
  onSwapped?: () => void;
}

/** Admin/Club Manager mid-match scorer swap — picker from the tournament pool of 5. */
export function ChangeMatchScorerDialog({
  visible,
  matchId,
  pickableScorers,
  currentScorerUserId,
  onClose,
  onSwapped,
}: ChangeMatchScorerDialogProps): React.ReactElement {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = pickableScorers
    .filter((scorer) => scorer.userId !== currentScorerUserId)
    .map((scorer) => ({
      value: scorer.userId,
      label: `${scorer.firstName} ${scorer.lastName}`.trim(),
    }));

  async function handleSubmit(): Promise<void> {
    if (!selectedUserId) {
      return;
    }
    setWorking(true);
    setError(null);
    try {
      await swapMatchScorer(matchId, { userId: selectedUserId });
      onSwapped?.();
      onClose();
      setSelectedUserId(null);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not change scorer.');
    } finally {
      setWorking(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <Pressable className="gap-4 rounded-t-2xl bg-background px-6 pb-10 pt-6" onPress={() => undefined}>
          <Text className="font-sans-bold text-xl text-on-surface">Change Scorer</Text>
          <Text className="font-sans text-sm text-on-surface-variant">
            Select a replacement from the tournament scorer pool.
          </Text>

          {error ? <Text className="font-sans text-sm text-primary">{error}</Text> : null}

          {options.length > 0 ? (
            <Select
              label="New Scorer"
              placeholder="Select scorer"
              value={selectedUserId}
              options={options}
              onChange={setSelectedUserId}
            />
          ) : (
            <Text className="font-sans text-sm text-on-surface-variant">
              No other tournament scorers available.
            </Text>
          )}

          <View className="flex-row gap-3">
            <Button label="Cancel" variant="outline" onPress={onClose} className="h-12 flex-1" />
            <Button
              label="Change Scorer"
              disabled={working || !selectedUserId}
              onPress={() => void handleSubmit()}
              className="h-12 flex-1"
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
