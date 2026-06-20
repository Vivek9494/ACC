import {
  MATCH_STATE_LABELS,
  MATCH_STATE_TRANSITIONS,
  type MatchDetail,
  type MatchSquadRole,
  type MatchState,
  type SquadPlayerView,
} from '@acc/types';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Button } from '../../../src/components/ui/Button';
import { Select } from '../../../src/components/ui/Select';
import { Text } from '../../../src/components/ui/Text';
import { FIELD_ORANGE } from '../../../src/components/ui/fieldStyles';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MatchStateBadge } from '../../../src/components/MatchStateBadge';
import {
  ApiRequestError,
  assignScorer,
  getMatch,
  revokeScorer,
  setMatchState,
} from '../../../src/lib/api';

// States reachable only through their dedicated payload endpoints (incl. the
// §13.1 scorecard confirmation, which has its own Result screen).
const DEDICATED_STATES: MatchState[] = [
  'PLAYING_XI_LOCKED',
  'TOSS_COMPLETED',
  'SCORECARD_LOCKED',
];
const LOCKABLE: MatchState[] = ['SCHEDULED', 'DELAYED'];
/** Post-match states that expose the Result & scorecard-confirmation screen. */
const POST_MATCH: MatchState[] = ['COMPLETED', 'NO_RESULT', 'SCORECARD_LOCKED'];

const ROLE_LABELS: Record<MatchSquadRole, string> = {
  PLAYING_XI: 'Playing 11',
  SUBSTITUTE: 'Substitute',
  IMPACT_CANDIDATE: 'Impact',
};

function tossSummary(match: MatchDetail): string | null {
  if (!match.tossWinner || !match.tossDecision) return null;
  const winner =
    match.tossWinner === 'TEAM_A'
      ? (match.homeTeamName ?? 'Home')
      : (match.awayTeamName ?? match.externalOpponentName ?? 'Away');
  return `${winner} won the toss and chose to ${match.tossDecision === 'BAT' ? 'bat' : 'bowl'}`;
}

export default function MatchDetailScreen(): React.ReactElement {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();

  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [assignScorerUserId, setAssignScorerUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!matchId) return;
    try {
      setMatch(await getMatch(matchId));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load match.');
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function run(action: () => Promise<MatchDetail>): Promise<void> {
    setWorking(true);
    try {
      setMatch(await action());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Action failed.');
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={FIELD_ORANGE} />
      </SafeAreaView>
    );
  }

  if (error && !match) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="px-6 py-12">
          <Pressable onPress={() => router.back()}>
            <Text className="font-sans text-primary">← Back</Text>
          </Pressable>
          <Text className="mt-6 font-sans text-base text-on-surface-variant">{error}</Text>
        </View>
      </SafeAreaView>
    );
  }
  if (!match) return <View />;

  const state = match.state;
  const systemTeams: { id: string; name: string }[] = [];
  if (match.homeTeamId) systemTeams.push({ id: match.homeTeamId, name: match.homeTeamName ?? 'Home' });
  if (match.awayTeamId) systemTeams.push({ id: match.awayTeamId, name: match.awayTeamName ?? 'Away' });

  const transitions = MATCH_STATE_TRANSITIONS[state].filter((s) => !DEDICATED_STATES.includes(s));
  const lockedUserIds = new Set(match.squads.flatMap((s) => s.players.map((p) => p.userId)));
  const activeScorerIds = new Set(match.activeScorers.map((s) => s.userId));
  const candidates: SquadPlayerView[] = match.squads.flatMap((s) =>
    s.players.filter((p) => p.role === 'PLAYING_XI' || p.role === 'SUBSTITUTE'),
  );
  const assignScorerOptions = (() => {
    const seen = new Set<string>();
    return candidates
      .filter((player) => !activeScorerIds.has(player.userId))
      .filter((player) => {
        if (seen.has(player.userId)) return false;
        seen.add(player.userId);
        return true;
      })
      .map((player) => ({
        value: player.userId,
        label: `${player.firstName} ${player.lastName}`,
      }));
  })();

  const toss = tossSummary(match);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="px-6 py-6 gap-4">
        <Pressable onPress={() => router.back()}>
          <Text className="font-sans text-primary">← Back</Text>
        </Pressable>

        <View className="gap-2">
          <Text className="font-sans-bold text-2xl text-on-surface">
            {match.homeTeamName ?? 'TBD'} vs{' '}
            {match.awayTeamName ?? match.externalOpponentName ?? 'TBD'}
          </Text>
          <MatchStateBadge state={state} />
          {match.matchCode ? (
            <Text className="font-sans-medium text-xs uppercase tracking-wider text-on-surface-variant">
              {match.matchCode}
            </Text>
          ) : null}
          {toss ? (
            <Text className="font-sans text-sm text-on-surface-variant">{toss}</Text>
          ) : null}
        </View>

        {error ? (
          <View className="rounded-lg bg-primary-50 px-4 py-3">
            <Text className="font-sans text-sm text-primary">{error}</Text>
          </View>
        ) : null}

        {/* Live scoring & viewing (§28, §29) */}
        {(['LIVE', 'RAIN_INTERRUPTED', 'COMPLETED', 'SCORECARD_LOCKED'] as MatchState[]).includes(
          state,
        ) ? (
          <View className="gap-2">
            <Button
              onPress={() => router.push(`/matches/${match.id}/live`)}
              variant="secondary"
              className="h-12"
              label="View Live Score"
            />
            {(['LIVE', 'RAIN_INTERRUPTED'] as MatchState[]).includes(state) ? (
              <Button
                onPress={() => router.push(`/matches/${match.id}/score`)}
                variant="outline"
                className="h-12 border-primary"
                textClassName="text-primary"
                label="Open Scoring"
              />
            ) : null}
          </View>
        ) : null}

        {/* Result & scorecard confirmation (§13, §16) */}
        {POST_MATCH.includes(state) ? (
          <Button
            onPress={() => router.push(`/matches/${match.id}/scorecard`)}
            className="h-12"
            label={
              state === 'SCORECARD_LOCKED'
                ? 'View Result & Scorecard'
                : 'Confirm Scorecard & Result'
            }
          />
        ) : null}

        {/* Playing 11 lock (§9.7) */}
        {LOCKABLE.includes(state) ? (
          <View className="gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
            <Text className="font-sans-bold text-lg text-primary">Playing 11</Text>
            <Text className="font-sans text-sm text-on-surface-variant">
              Post the final 11 + 2 substitutes for each team.
            </Text>
            {systemTeams.map((t) => {
              const locked = match.squads.some((s) => s.teamId === t.id);
              return (
                <Button
                  key={t.id}
                  onPress={() =>
                    router.push(
                      `/matches/${match.id}/playing-xi?teamId=${t.id}&teamName=${encodeURIComponent(t.name)}`,
                    )
                  }
                  variant="outline"
                  className="h-12 flex-row justify-between border-primary px-4"
                >
                  <Text className="font-sans-semibold text-sm text-primary">
                    {locked ? 'Edit' : 'Select'} 11 · {t.name}
                  </Text>
                  {locked ? <Text className="font-sans text-xs text-primary">Locked ✓</Text> : null}
                </Button>
              );
            })}
          </View>
        ) : null}

        {/* Locked squads */}
        {match.squads.map((squad) => (
          <View
            key={squad.teamId}
            className="gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest p-4"
          >
            <Text className="font-sans-bold text-lg text-primary">{squad.teamName} XI</Text>
            {squad.players.map((p) => (
              <View key={p.userId} className="flex-row items-center justify-between">
                <Text className="font-sans text-sm text-on-surface">
                  {p.firstName} {p.lastName}
                  {p.isActiveImpact ? ' ★' : ''}
                </Text>
                <Text className="font-sans-medium text-[10px] uppercase tracking-wider text-on-surface-variant">
                  {ROLE_LABELS[p.role]}
                </Text>
              </View>
            ))}
          </View>
        ))}

        {/* Toss (§11.2) */}
        {state === 'PLAYING_XI_LOCKED' ? (
          <Button
            onPress={() => router.push(`/matches/${match.id}/toss`)}
            className="h-12"
            label="Record Toss"
          />
        ) : null}

        {/* Scorer assignment (§11.1) */}
        {lockedUserIds.size > 0 ? (
          <View className="gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
            <Text className="font-sans-bold text-lg text-primary">Scorer</Text>
            {match.activeScorers.length > 0 ? (
              match.activeScorers.map((s) => (
                <View key={s.userId} className="flex-row items-center justify-between">
                  <Text className="font-sans-semibold text-sm text-on-surface">
                    {s.firstName} {s.lastName}
                  </Text>
                  <Button
                    disabled={working}
                    onPress={() => void run(() => revokeScorer(match.id, s.userId))}
                    variant="destructive"
                    className="px-3 py-1"
                    textClassName="font-sans text-xs"
                    label="Revoke"
                  />
                </View>
              ))
            ) : (
              <Text className="font-sans text-sm text-on-surface-variant">
                No scorer assigned. Choose a squad player below.
              </Text>
            )}
            {assignScorerOptions.length > 0 ? (
              <Select
                label="Assign Scorer"
                placeholder="Select player"
                value={assignScorerUserId}
                options={assignScorerOptions}
                onChange={setAssignScorerUserId}
              />
            ) : null}
            {assignScorerUserId ? (
              <Button
                disabled={working}
                onPress={() =>
                  void run(async () => {
                    const updated = await assignScorer(match.id, { userId: assignScorerUserId });
                    setAssignScorerUserId(null);
                    return updated;
                  })
                }
                className="h-12"
                label="Grant Scorer"
              />
            ) : null}
          </View>
        ) : null}

        {/* Match state machine (§5.2) */}
        {transitions.length > 0 ? (
          <View className="gap-2">
            <Text className="font-sans-medium text-xs uppercase tracking-wider text-on-surface-variant">
              Match Status
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {transitions.map((next) => (
                <Button
                  key={next}
                  disabled={working}
                  onPress={() => void run(() => setMatchState(match.id, next))}
                  variant="outline"
                  className="border-primary px-4 py-2"
                  textClassName="text-primary"
                  label={MATCH_STATE_LABELS[next]}
                />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
