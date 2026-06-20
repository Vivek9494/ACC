import type { MatchDetail, MatchSquadRole, SquadPlayerView } from '@acc/types';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, View } from 'react-native';

import { ApiRequestError, assignScorer, getMatch } from '../../lib/api';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Text } from '../ui/Text';
import { FIELD_ORANGE } from '../ui/fieldStyles';

const ELIGIBLE_ROLES: MatchSquadRole[] = ['PLAYING_XI', 'SUBSTITUTE'];

export interface AssignScorerDialogProps {
  visible: boolean;
  matchId: string | null;
  /** Currently assigned scorer — pre-selected when switching. */
  assignedScorerUserId?: string | null;
  onClose: () => void;
  onAssigned?: () => void;
}

function squadCandidates(match: MatchDetail): SquadPlayerView[] {
  const seen = new Set<string>();
  return match.squads
    .flatMap((squad) => squad.players.filter((p) => ELIGIBLE_ROLES.includes(p.role)))
    .filter((player) => {
      if (seen.has(player.userId)) {
        return false;
      }
      seen.add(player.userId);
      return true;
    });
}

/** §11.1 assign / switch per-match Scorer — shared by match detail and captain dashboard. */
export function AssignScorerDialog({
  visible,
  matchId,
  assignedScorerUserId = null,
  onClose,
  onAssigned,
}: AssignScorerDialogProps): React.ReactElement {
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !matchId) {
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    void getMatch(matchId)
      .then((detail) => {
        if (!active) {
          return;
        }
        setMatch(detail);
        setSelectedUserId(assignedScorerUserId);
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof ApiRequestError ? err.message : 'Could not load match.');
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [visible, matchId, assignedScorerUserId]);

  const options = useMemo(() => {
    if (!match) {
      return [];
    }
    return squadCandidates(match).map((player) => ({
      value: player.userId,
      label: `${player.firstName} ${player.lastName}`,
    }));
  }, [match]);

  const hasAssignedScorer = Boolean(assignedScorerUserId);
  const submitLabel = hasAssignedScorer ? 'Switch Scorer' : 'Assign Scorer';

  async function handleSubmit(): Promise<void> {
    if (!matchId || !selectedUserId) {
      return;
    }
    setWorking(true);
    setError(null);
    try {
      await assignScorer(matchId, { userId: selectedUserId });
      onAssigned?.();
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError && err.error.code === 'SCORER_ALREADY_ASSIGNED') {
        onAssigned?.();
        onClose();
        return;
      }
      setError(err instanceof ApiRequestError ? err.message : 'Could not assign scorer.');
    } finally {
      setWorking(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <Pressable className="gap-4 rounded-t-2xl bg-background px-6 pb-10 pt-6" onPress={() => undefined}>
          <Text className="font-sans-bold text-xl text-on-surface">
            {hasAssignedScorer ? 'Switch Scorer' : 'Assign Scorer'}
          </Text>
          <Text className="font-sans text-sm text-on-surface-variant">
            Choose a squad player to score this match.
          </Text>

          {loading ? (
            <ActivityIndicator color={FIELD_ORANGE} />
          ) : null}

          {error ? <Text className="font-sans text-sm text-primary">{error}</Text> : null}

          {!loading && match && options.length > 0 ? (
            <Select
              label="Scorer"
              placeholder="Select player"
              value={selectedUserId}
              options={options}
              onChange={setSelectedUserId}
            />
          ) : null}

          {!loading && match && options.length === 0 ? (
            <Text className="font-sans text-sm text-on-surface-variant">
              No eligible squad players. Lock Playing 11 first.
            </Text>
          ) : null}

          <View className="flex-row gap-3">
            <Button label="Cancel" variant="outline" onPress={onClose} className="h-12 flex-1" />
            <Button
              label={submitLabel}
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
