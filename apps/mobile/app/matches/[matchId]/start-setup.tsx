import {
  type MatchDetail,
  type MatchSide,
  type TossDecision,
} from '@acc/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../../src/components/ui/Button';
import { Select } from '../../../src/components/ui/Select';
import { Text } from '../../../src/components/ui/Text';
import { FIELD_ORANGE } from '../../../src/components/ui/fieldStyles';
import { ApiRequestError, getMatch, startMatchSetup } from '../../../src/lib/api';
import { deriveInningsTeamsFromToss, playingXiPlayers } from '../../../src/lib/match-start';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => word.slice(0, 1))
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function MatchStartSetupScreen(): React.ReactElement {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();

  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const [tossWinner, setTossWinner] = useState<MatchSide | null>(null);
  const [tossDecision, setTossDecision] = useState<TossDecision | null>(null);
  const [strikerUserId, setStrikerUserId] = useState<string | null>(null);
  const [nonStrikerUserId, setNonStrikerUserId] = useState<string | null>(null);
  const [bowlerUserId, setBowlerUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!matchId) {
      return;
    }
    setLoading(true);
    try {
      setMatch(await getMatch(matchId));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load match.');
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    void load();
  }, [load]);

  const playingXiLocked =
    match?.state === 'PLAYING_XI_LOCKED' ||
    match?.state === 'TOSS_COMPLETED' ||
    match?.state === 'DELAYED';

  const teamSides = useMemo(() => {
    if (!match) {
      return [];
    }
    const teamA = match.homeTeamName ?? 'Home';
    const teamB = match.awayTeamName ?? match.externalOpponentName ?? 'Away';
    return [
      { side: 'TEAM_A' as MatchSide, name: teamA },
      { side: 'TEAM_B' as MatchSide, name: teamB },
    ];
  }, [match]);

  const inningsTeams = useMemo(() => {
    if (!match || !tossWinner || !tossDecision) {
      return null;
    }
    return deriveInningsTeamsFromToss(match, tossWinner, tossDecision);
  }, [match, tossDecision, tossWinner]);

  const battingOptions = useMemo(
    () =>
      playingXiPlayers(match?.squads ?? [], inningsTeams?.battingTeamId ?? null).map((player) => ({
        value: player.userId,
        label: player.label,
      })),
    [inningsTeams?.battingTeamId, match?.squads],
  );

  const bowlingOptions = useMemo(
    () =>
      playingXiPlayers(match?.squads ?? [], inningsTeams?.bowlingTeamId ?? null).map((player) => ({
        value: player.userId,
        label: player.label,
      })),
    [inningsTeams?.bowlingTeamId, match?.squads],
  );

  async function handleSubmit(): Promise<void> {
    if (!matchId || !match || !tossWinner || !tossDecision) {
      setError('Select the toss winner and decision.');
      return;
    }
    if (!playingXiLocked) {
      setError('Lock the Playing 11 for all teams before starting.');
      return;
    }
    if (!strikerUserId || !nonStrikerUserId || !bowlerUserId) {
      setError('Select opening striker, non-striker, and bowler.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      await startMatchSetup(matchId, {
        tossWinner,
        tossDecision,
        strikerUserId,
        nonStrikerUserId,
        bowlerUserId,
      });
      router.replace(`/matches/${matchId}/score`);
    } catch (err) {
      if (err instanceof ApiRequestError && err.error.fields) {
        setFieldErrors(err.error.fields);
        setError(null);
      } else {
        setError(err instanceof ApiRequestError ? err.message : 'Could not start the match.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator color={FIELD_ORANGE} />
      </SafeAreaView>
    );
  }

  if (!match) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <View className="px-6 py-12">
          <Pressable onPress={() => router.back()}>
            <Text className="font-sans text-primary">← Back</Text>
          </Pressable>
          <Text className="mt-6 font-sans text-base text-on-surface-variant">
            {error ?? 'Match not found.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView contentContainerClassName="gap-5 px-4 py-4 pb-10">
        <Pressable onPress={() => router.back()}>
          <Text className="font-sans text-primary">← Back</Text>
        </Pressable>

        <Text className="font-sans-bold text-2xl text-on-surface">Match Setup</Text>
        <Text className="font-sans text-sm text-on-surface-variant">
          Record the toss and choose opening players to begin scoring.
        </Text>

        {!playingXiLocked ? (
          <View className="gap-3 rounded-control border border-outline-variant bg-surface-container-lowest p-4">
            <Text className="font-sans text-sm text-on-surface">
              Playing 11 must be locked for all teams before you can start the match (§11).
            </Text>
            <Button
              label="Lock Playing 11"
              onPress={() => router.push(`/matches/${match.id}/playing-xi`)}
              className="h-12"
            />
          </View>
        ) : null}

        {error ? (
          <View className="rounded-control bg-error-container px-4 py-3">
            <Text className="font-sans text-sm text-on-error-container">{error}</Text>
          </View>
        ) : null}

        <View className="gap-3">
          <Text className="font-sans-medium text-xs uppercase tracking-wider text-on-surface-variant">
            Who won the toss?
          </Text>
          <View className="flex-row gap-3">
            {teamSides.map((side) => {
              const active = tossWinner === side.side;
              return (
                <Button
                  key={side.side}
                  onPress={() => setTossWinner(side.side)}
                  variant={active ? 'primary' : 'outline'}
                  className={`flex-1 gap-2 p-4 ${active ? 'border-primary' : 'bg-white'}`}
                >
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-surface-container-high">
                    <Text className="font-sans-bold text-on-surface-variant">
                      {initials(side.name)}
                    </Text>
                  </View>
                  <Text
                    className={`text-center font-sans-semibold text-sm ${
                      active ? 'text-on-primary' : 'text-on-surface'
                    }`}
                  >
                    {side.name}
                  </Text>
                </Button>
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
              const active = tossDecision === decision;
              return (
                <Button
                  key={decision}
                  onPress={() => setTossDecision(decision)}
                  variant={active ? 'primary' : 'outline'}
                  className={`flex-1 py-4 ${active ? 'border-primary' : 'bg-white'}`}
                  textClassName={`text-base ${active ? 'text-on-primary' : 'text-on-surface'}`}
                  label={decision === 'BAT' ? 'Bat' : 'Bowl'}
                />
              );
            })}
          </View>
        </View>

        {inningsTeams ? (
          <View className="gap-4 rounded-control border border-outline-variant bg-white p-4">
            <Select
              label="Opening Striker"
              placeholder="Select striker"
              value={strikerUserId}
              options={battingOptions.filter((option) => option.value !== nonStrikerUserId)}
              onChange={setStrikerUserId}
              error={fieldErrors.strikerUserId}
            />
            <Select
              label="Opening Non-Striker"
              placeholder="Select non-striker"
              value={nonStrikerUserId}
              options={battingOptions.filter((option) => option.value !== strikerUserId)}
              onChange={setNonStrikerUserId}
              error={fieldErrors.nonStrikerUserId}
            />
            <Select
              label="Opening Bowler"
              placeholder="Select bowler"
              value={bowlerUserId}
              options={bowlingOptions}
              onChange={setBowlerUserId}
              error={fieldErrors.bowlerUserId}
            />
          </View>
        ) : null}

        <Button
          disabled={
            submitting ||
            !playingXiLocked ||
            !tossWinner ||
            !tossDecision ||
            !strikerUserId ||
            !nonStrikerUserId ||
            !bowlerUserId
          }
          onPress={() => void handleSubmit()}
          className="h-14 w-full flex-row gap-2"
        >
          <Text className="font-sans-semibold text-base text-on-primary">
            {submitting ? 'Starting…' : 'Start Match'}
          </Text>
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
