import type { ScorerStartableMatch } from '@acc/types';
import { MatchSide, type TossDecision } from '@acc/types';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { ApiRequestError, startScoring } from '../../lib/api';
import { Button } from '../ui/Button';
import { TeamAvatar } from '../ui/TeamAvatar';
import { Text } from '../ui/Text';
import { INPUT_SHADOW_STYLE } from '../ui/fieldStyles';

export interface MatchSetupDialogProps {
  visible: boolean;
  match: ScorerStartableMatch | null;
  onClose: () => void;
}

/** Toss capture dialog opened from the scorer Start Match card (§11.2). */
export function MatchSetupDialog({
  visible,
  match,
  onClose,
}: MatchSetupDialogProps): React.ReactElement {
  const router = useRouter();
  const [tossWinner, setTossWinner] = useState<MatchSide | null>(null);
  const [tossDecision, setTossDecision] = useState<TossDecision | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setTossWinner(null);
      setTossDecision(null);
      setError(null);
      setSubmitting(false);
    }
  }, [visible, match?.matchId]);

  const canStartScoring = Boolean(tossWinner && tossDecision);

  async function handleStartScoring(): Promise<void> {
    if (!match || !tossWinner || !tossDecision) {
      return;
    }
    if (!match.playingXiLocked) {
      setError('Lock the Playing 11 for all teams before starting (§11).');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await startScoring(match.matchId, { tossWinner, decision: tossDecision });
      onClose();
      router.push(`/matches/${match.matchId}/score`);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not start scoring.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!match) {
    return <Modal visible={false} transparent animationType="fade" />;
  }

  const teamSides = [
    { side: MatchSide.TeamA, name: match.teamA.name, logoUrl: match.teamA.logoUrl },
    { side: MatchSide.TeamB, name: match.teamB.name, logoUrl: match.teamB.logoUrl },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-center bg-on-surface/40 px-4" onPress={onClose}>
        <Pressable
          className="overflow-hidden rounded-control border border-outline-variant bg-surface"
          style={INPUT_SHADOW_STYLE}
          onPress={(event) => event.stopPropagation()}
        >
          <View className="border-b border-surface-container px-6 py-5">
            <Text className="font-sans-bold text-xl text-on-surface">Match Setup</Text>
          </View>

          <View className="gap-6 px-6 py-6">
            {!match.playingXiLocked ? (
              <View className="gap-3 rounded-control border border-outline-variant bg-surface-container-lowest p-4">
                <Text className="font-sans text-sm text-on-surface">
                  Playing 11 must be locked before you can start scoring (§11).
                </Text>
                <Button
                  label="Lock Playing 11"
                  onPress={() => {
                    onClose();
                    router.push(`/matches/${match.matchId}/playing-xi`);
                  }}
                  className="h-11"
                />
              </View>
            ) : null}

            {error ? (
              <View className="rounded-control bg-primary-50 px-4 py-3">
                <Text className="font-sans text-sm text-primary">{error}</Text>
              </View>
            ) : null}

            <View className="gap-3">
              <Text className="font-sans-medium text-xs uppercase tracking-wider text-on-surface-variant">
                Who won the toss?
              </Text>
              <View className="flex-row gap-3">
                {teamSides.map((team) => {
                  const selected = tossWinner === team.side;
                  return (
                    <Pressable
                      key={team.side}
                      onPress={() => setTossWinner(team.side)}
                      className={`flex-1 items-center gap-2 rounded-control border p-4 active:opacity-80 ${
                        selected ? 'border-primary bg-primary/5' : 'border-outline-variant bg-surface'
                      }`}
                    >
                      <TeamAvatar name={team.name} logoUrl={team.logoUrl} size="md" />
                      <Text
                        className={`text-center font-sans-semibold text-sm ${
                          selected ? 'text-primary' : 'text-on-surface'
                        }`}
                      >
                        {team.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View className="gap-3">
              <Text className="font-sans-medium text-xs uppercase tracking-wider text-on-surface-variant">
                Choose to
              </Text>
              <View className="flex-row gap-3">
                {(['BAT', 'BOWL'] as TossDecision[]).map((decision) => {
                  const selected = tossDecision === decision;
                  return (
                    <Button
                      key={decision}
                      onPress={() => setTossDecision(decision)}
                      variant={selected ? 'primary' : 'outline'}
                      className={`flex-1 py-4 ${selected ? 'border-primary' : 'bg-surface'}`}
                      textClassName={`text-base ${selected ? 'text-on-primary' : 'text-on-surface'}`}
                      label={decision === 'BAT' ? 'Bat' : 'Bowl'}
                    />
                  );
                })}
              </View>
            </View>

            <Button
              disabled={!canStartScoring || submitting}
              onPress={() => void handleStartScoring()}
              className="h-14 w-full"
              label={submitting ? 'Starting…' : 'Start Scoring'}
            />

            <Pressable onPress={onClose} disabled={submitting} className="items-center py-1">
              <Text className="font-sans-semibold text-sm text-primary">Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
