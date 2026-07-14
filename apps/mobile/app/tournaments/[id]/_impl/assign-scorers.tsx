import {
  TOURNAMENT_SCORER_COUNT,
  formatRemovedScorerResetAlert,
  type SetTournamentScorersRequest,
} from '@acc/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TournamentScorerSelectCard } from '../../../../src/components/tournament/TournamentScorerSelectCard';
import { Button } from '../../../../src/components/ui/Button';
import { KeyboardAwareFormScrollView } from '../../../../src/components/ui/KeyboardAwareFormScrollView';
import { ScreenHeader } from '../../../../src/components/ui/ScreenHeader';
import { SuccessDialog } from '../../../../src/components/ui/SuccessDialog';
import { Text } from '../../../../src/components/ui/Text';
import { TextInput } from '../../../../src/components/ui/TextInput';
import { FIELD_ORANGE } from '../../../../src/components/ui/fieldStyles';
import {
  ApiRequestError,
  getTournamentScorersSelection,
  setTournamentScorers,
} from '../../../../src/lib/api';

export default function AssignTournamentScorersScreen(): React.ReactElement {
  const { id: tournamentId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [pool, setPool] = useState<
    Awaited<ReturnType<typeof getTournamentScorersSelection>>['pool']
  >([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [scorersEditLocked, setScorersEditLocked] = useState(false);
  const [scorersEditLockedMessage, setScorersEditLockedMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const [resetAlertOpen, setResetAlertOpen] = useState(false);
  const [resetAlertMessage, setResetAlertMessage] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    if (!tournamentId) {
      setError('Tournament not found.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await getTournamentScorersSelection(tournamentId);
      setPool(data.pool);
      setSelectedIds(new Set(data.scorers.map((scorer) => scorer.userId)));
      setScorersEditLocked(data.scorersEditLocked);
      setScorersEditLockedMessage(data.scorersEditLockedMessage);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load scorer selection.');
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredPool = debouncedSearch
    ? pool.filter((player) => {
        const haystack =
          `${player.firstName} ${player.lastName} ${player.centerName}`.toLowerCase();
        return haystack.includes(debouncedSearch);
      })
    : pool;

  const selectedCount = selectedIds.size;

  const toggleSelection = useCallback((userId: string): void => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(userId)) {
        next.delete(userId);
      } else if (next.size >= TOURNAMENT_SCORER_COUNT) {
        return current;
      } else {
        next.add(userId);
      }
      return next;
    });
  }, []);

  async function handleSubmit(): Promise<void> {
    if (!tournamentId || selectedCount !== TOURNAMENT_SCORER_COUNT || scorersEditLocked) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const body: SetTournamentScorersRequest = {
        userIds: [...selectedIds],
      };
      const response = await setTournamentScorers(tournamentId, body);
      const resetAlert = formatRemovedScorerResetAlert(response.removedScorerResets);
      if (resetAlert) {
        setResetAlertMessage(resetAlert);
        setResetAlertOpen(true);
      } else {
        setSuccessOpen(true);
      }
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not save tournament scorers.');
    } finally {
      setSubmitting(false);
    }
  }

  const selectionDisabled = scorersEditLocked || submitting;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScreenHeader
        title="Assign Scorers"
        subtitle="Select exactly 5 registered players"
        onBack={() => router.back()}
      />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={FIELD_ORANGE} />
        </View>
      ) : (
        <KeyboardAwareFormScrollView
          className="flex-1"
          contentContainerClassName="gap-4 px-4 pb-10 pt-2"
          footer={
            <View className="gap-3 border-t border-outline-variant bg-background px-4 pb-4 pt-3">
              {scorersEditLocked && scorersEditLockedMessage ? (
                <Text className="text-center font-sans text-sm text-primary">
                  {scorersEditLockedMessage}
                </Text>
              ) : null}
              <Text className="text-center font-sans-semibold text-sm text-on-surface">
                {selectedCount} of {TOURNAMENT_SCORER_COUNT} selected
              </Text>
              <Button
                label={submitting ? 'Saving…' : 'Save Scorers'}
                disabled={selectionDisabled || selectedCount !== TOURNAMENT_SCORER_COUNT}
                onPress={() => void handleSubmit()}
                className="h-14 w-full"
              />
            </View>
          }
        >
          <TextInput
            placeholder="Search by name or center…"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {error ? (
            <Text className="font-sans text-sm text-primary">{error}</Text>
          ) : null}

          {scorersEditLocked && scorersEditLockedMessage ? (
            <View className="rounded-control border border-outline-variant bg-surface-container-lowest p-4">
              <Text className="font-sans text-sm text-on-surface-variant">
                {scorersEditLockedMessage}
              </Text>
            </View>
          ) : null}

          {filteredPool.length === 0 ? (
            <Text className="py-8 text-center font-sans text-base text-on-surface-variant">
              No registered players match your search.
            </Text>
          ) : (
            filteredPool.map((player) => {
              const selected = selectedIds.has(player.userId);
              const atCapacity = !selected && selectedCount >= TOURNAMENT_SCORER_COUNT;
              return (
                <TournamentScorerSelectCard
                  key={player.userId}
                  player={player}
                  selected={selected}
                  disabled={scorersEditLocked || atCapacity}
                  onToggle={() => toggleSelection(player.userId)}
                />
              );
            })
          )}
        </KeyboardAwareFormScrollView>
      )}

      <SuccessDialog
        visible={resetAlertOpen}
        title="Match scorers cleared"
        message={resetAlertMessage ?? ''}
        autoDismissMs={0}
        continueLabel="OK"
        onDismiss={() => {
          setResetAlertOpen(false);
          setResetAlertMessage(null);
          router.back();
        }}
      />

      <SuccessDialog
        visible={successOpen}
        title="Scorers saved"
        message={`${TOURNAMENT_SCORER_COUNT} tournament scorers have been assigned.`}
        onDismiss={() => {
          setSuccessOpen(false);
          router.back();
        }}
      />
    </SafeAreaView>
  );
}
