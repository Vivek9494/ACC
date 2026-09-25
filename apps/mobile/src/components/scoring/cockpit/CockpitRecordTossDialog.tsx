import {
  MatchSide,
  type MatchDetail,
  type TossDecision,
} from '@acc/types';
import { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { ApiRequestError, startScoring } from '../../../lib/api';
import { Button } from '../../ui/Button';
import { TeamAvatar } from '../../ui/TeamAvatar';
import { Text } from '../../ui/Text';
import { INPUT_SHADOW_STYLE } from '../../ui/fieldStyles';

export interface CockpitRecordTossDialogProps {
  visible: boolean;
  matchId: string;
  match: MatchDetail;
  onClose: () => void;
  /** Called after toss + first innings open succeed — parent should reload match/scorecard. */
  onRecorded: () => void | Promise<void>;
}

/**
 * Electron/desktop cockpit — Record Toss as a centered modal (same shell as
 * SelectBatsmanDialog). Calls startScoring so Live + innings 1 open after toss.
 * Mobile keeps MatchSetupDialog / the /toss stack screen.
 */
export function CockpitRecordTossDialog({
  visible,
  matchId,
  match,
  onClose,
  onRecorded,
}: CockpitRecordTossDialogProps): React.ReactElement {
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
  }, [visible, matchId]);

  const teamAName = match.homeTeamName ?? 'Team A';
  const teamBName = match.awayTeamName ?? match.externalOpponentName ?? 'Team B';
  const canSubmit = Boolean(tossWinner && tossDecision);

  async function handleSubmit(): Promise<void> {
    if (!tossWinner || !tossDecision) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await startScoring(matchId, { tossWinner, decision: tossDecision });
      await onRecorded();
      onClose();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not record toss.');
    } finally {
      setSubmitting(false);
    }
  }

  const teamSides = [
    { side: MatchSide.TeamA, name: teamAName, logoUrl: null as string | null },
    { side: MatchSide.TeamB, name: teamBName, logoUrl: null as string | null },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-center bg-on-surface/40 px-4" onPress={onClose}>
        <Pressable
          className="mx-auto w-full max-w-lg overflow-hidden rounded-control border border-outline-variant bg-surface"
          style={INPUT_SHADOW_STYLE}
          onPress={(event) => event.stopPropagation()}
        >
          <View className="border-b border-surface-container px-6 py-5">
            <Text className="font-sans-bold text-xl text-on-surface">Record Toss</Text>
          </View>

          <View className="gap-6 px-6 py-6">
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
                        selected
                          ? 'border-primary bg-primary/5'
                          : 'border-outline-variant bg-surface'
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
              disabled={!canSubmit || submitting}
              onPress={() => void handleSubmit()}
              className="h-14 w-full"
              label={submitting ? 'Recording…' : 'Record Toss & Start Scoring'}
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
