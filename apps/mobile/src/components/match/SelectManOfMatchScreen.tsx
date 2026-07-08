import {
  type ManOfMatchEligibilityView,
  type MatchDetail,
  type ScorecardResponse,
} from '@acc/types';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ApiRequestError,
  getManOfMatchEligibility,
  getMatch,
  getScorecard,
  selectManOfMatch,
} from '../../lib/api';
import { confirmActionAlert } from '../../lib/confirm-action-alert';
import {
  buildManOfMatchCandidates,
  isManOfMatchApplicable,
} from '../../lib/match-completion';
import { Button } from '../ui/Button';
import {
  KeyboardAwareFormContainer,
  KeyboardAwareFormScrollView,
} from '../ui/KeyboardAwareFormScrollView';
import { ScreenHeader } from '../ui/ScreenHeader';
import { Text } from '../ui/Text';
import { FIELD_ORANGE } from '../ui/fieldStyles';
import { ManOfMatchCandidateRow } from './ManOfMatchCandidateRow';

export interface SelectManOfMatchScreenProps {
  matchId: string;
}

function dueLabel(dueAt: string | null | undefined, overdue: boolean | undefined): string | null {
  if (!dueAt) return null;
  const day = dueAt.slice(0, 10);
  if (overdue) {
    return `Overdue — required by end of match day (${day})`;
  }
  return `Required by end of match day (${day})`;
}

/** Full-page MoM picker for the winning team's captain or vice-captain (§13.3). */
export function SelectManOfMatchScreen({
  matchId,
}: SelectManOfMatchScreenProps): React.ReactElement {
  const router = useRouter();
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [card, setCard] = useState<ScorecardResponse | null>(null);
  const [eligibility, setEligibility] = useState<ManOfMatchEligibilityView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [loadedMatch, loadedCard, loadedEligibility] = await Promise.all([
        getMatch(matchId),
        getScorecard(matchId),
        getManOfMatchEligibility(matchId),
      ]);
      setMatch(loadedMatch);
      setCard(loadedCard);
      setEligibility(loadedEligibility);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load Man of the Match.');
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    void load();
  }, [load]);

  const candidates = useMemo(
    () => (match && card ? buildManOfMatchCandidates(match, card) : []),
    [card, match],
  );

  const existingMomUserId = match?.manOfTheMatchUserId ?? null;

  useEffect(() => {
    if (existingMomUserId && candidates.some((c) => c.userId === existingMomUserId)) {
      setSelectedId(existingMomUserId);
    }
  }, [candidates, existingMomUserId]);

  const deadlineLine = dueLabel(eligibility?.dueAt, eligibility?.overdue);
  const showDeadlineNote = Boolean(eligibility?.required || deadlineLine);
  const canSelect =
    Boolean(eligibility?.offered && eligibility.canSelect) && isManOfMatchApplicable(match, card);

  function handleSubmit(): void {
    if (!selectedId) return;
    const candidate = candidates.find((c) => c.userId === selectedId);
    const playerName = candidate
      ? `${candidate.firstName} ${candidate.lastName}`.trim()
      : 'this player';

    confirmActionAlert({
      title: 'Confirm Man of the Match',
      message: `Award Man of the Match to ${playerName}?`,
      confirmLabel: 'Confirm',
      onConfirm: async () => {
        setSubmitting(true);
        try {
          await selectManOfMatch(matchId, { userId: selectedId });
          router.back();
        } catch (err) {
          Alert.alert(
            'Could not award Man of the Match',
            err instanceof ApiRequestError ? err.message : 'Please try again.',
          );
        } finally {
          setSubmitting(false);
        }
      },
    });
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <KeyboardAwareFormContainer className="flex-1">
        <ScreenHeader title="Man of the Match" onBack={() => router.back()} />

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={FIELD_ORANGE} />
          </View>
        ) : error ? (
          <View className="flex-1 px-4">
            <View className="rounded-control bg-primary-50 px-4 py-3">
              <Text className="font-sans text-sm text-primary">{error}</Text>
            </View>
            <Button label="Retry" onPress={() => void load()} className="mt-4 h-11" />
          </View>
        ) : !canSelect ? (
          <View className="flex-1 px-4">
            <View className="rounded-control border border-outline-variant bg-surface p-4">
              <Text className="font-sans text-sm text-on-surface-variant">
                Man of the Match selection is not available for this match.
              </Text>
            </View>
          </View>
        ) : (
          <>
            <KeyboardAwareFormScrollView
              contentContainerClassName="gap-4 px-4 pt-2"
              extraBottomPadding={32}
              footer={
                <SafeAreaView
                  edges={['bottom']}
                  className="border-t border-outline-variant/20 bg-background px-4 pt-3"
                >
                  <Button
                    label={submitting ? 'Submitting…' : 'Submit'}
                    disabled={selectedId == null || submitting}
                    onPress={handleSubmit}
                    className="h-14 w-full"
                  />
                </SafeAreaView>
              }
            >
              {showDeadlineNote ? (
                <View className="gap-0.5">
                  {eligibility?.required ? (
                    <Text className="font-sans-semibold text-sm text-primary">Required</Text>
                  ) : null}
                  {deadlineLine ? (
                    <Text
                      className={`font-sans text-sm ${
                        eligibility?.overdue ? 'text-secondary-900' : 'text-on-surface-variant'
                      }`}
                    >
                      {deadlineLine}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {candidates.length === 0 ? (
                <View className="rounded-control border border-outline-variant bg-surface p-4">
                  <Text className="font-sans text-sm text-on-surface-variant">
                    No eligible players with batting or bowling figures were found for the winning
                    team.
                  </Text>
                </View>
              ) : (
                <View className="gap-2">
                  {candidates.map((candidate) => (
                    <ManOfMatchCandidateRow
                      key={candidate.userId}
                      candidate={candidate}
                      selected={selectedId === candidate.userId}
                      onPress={() => setSelectedId(candidate.userId)}
                    />
                  ))}
                </View>
              )}
            </KeyboardAwareFormScrollView>
          </>
        )}
      </KeyboardAwareFormContainer>
    </SafeAreaView>
  );
}
