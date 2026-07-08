import {
  buildMatchPlayingXiFinalizationStatus,
  BallType,
  canViewAdminUsersDirectory,
  getMatchDetailStatusTransitions,
  isAccRegisteredOpponent,
  isExternalOpponentMatch,
  MATCH_STATE_LABELS,
  MatchState,
  canShowRecordToss,
  canViewMatchPlayersPunchTimeButton,
  PLAYING_XI_SIZE,
  type MatchDetail,
  type MatchSquadRole,
  type SquadPlayerView,
} from '@acc/types';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { Button } from '../../../src/components/ui/Button';
import { Select } from '../../../src/components/ui/Select';
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader';
import { Text } from '../../../src/components/ui/Text';
import { FIELD_ORANGE } from '../../../src/components/ui/fieldStyles';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MatchStateBadge } from '../../../src/components/MatchStateBadge';
import { DelayMatchDialog } from '../../../src/components/match/DelayMatchDialog';
import { MatchDetailsSection } from '../../../src/components/match/MatchDetailsSection';
import { MatchManOfMatchBlock } from '../../../src/components/match/MatchManOfMatchBlock';
import { MatchTennisScorerSection } from '../../../src/components/match/MatchTennisScorerSection';
import {
  ApiRequestError,
  assignScorer,
  delayMatch,
  getMatch,
  revokeScorer,
  setMatchState,
} from '../../../src/lib/api';
import { useAuth } from '../../../src/lib/auth-context';
import { confirmActionAlert } from '../../../src/lib/confirm-action-alert';
import { invalidateMatchData } from '../../../src/lib/match-data-invalidation';
import { canLockPlayingXiForTeam, canVerifyPlayingXiForMatch } from '../../../src/lib/team-lead-access';
import { resolveVenueDisplayTimezone } from '../../../src/lib/venue-time';

/** Post-match states where the scorecard result screen is the primary view. */
const POST_MATCH: MatchState[] = ['COMPLETED', 'NO_RESULT', 'SCORECARD_LOCKED'];
const LOCKABLE: MatchState[] = ['SCHEDULED', 'PLAYING_XI_LOCKED', 'TOSS_COMPLETED', 'DELAYED'];

const ROLE_LABELS: Record<MatchSquadRole, string> = {
  PLAYING_XI: 'Playing 11',
  SUBSTITUTE: 'Substitute',
  IMPACT_CANDIDATE: 'Impact',
};

export default function MatchDetailScreen(): React.ReactElement {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [assignScorerUserId, setAssignScorerUserId] = useState<string | null>(null);
  const [delayDialogVisible, setDelayDialogVisible] = useState(false);

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

  const transitions = useMemo(() => {
    if (!match) {
      return [];
    }
    const { timezone } = resolveVenueDisplayTimezone(match.tournamentTimezone);
    const options = getMatchDetailStatusTransitions({
      state: match.state,
      matchDate: match.matchDate,
      startTime: match.startTime,
      timeZone: timezone,
    });
    if (user != null && canViewAdminUsersDirectory(user.role)) {
      return options;
    }
    return options.filter((next) => next !== MatchState.Delayed);
  }, [match, user]);

  async function run(action: () => Promise<MatchDetail>): Promise<void> {
    setWorking(true);
    try {
      setMatch(await action());
      setError(null);
      invalidateMatchData();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Action failed.');
    } finally {
      setWorking(false);
    }
  }

  function handleStateTransition(next: MatchState): void {
    if (next === MatchState.Delayed) {
      setDelayDialogVisible(true);
      return;
    }
    if (next === MatchState.Cancelled) {
      confirmActionAlert({
        title: 'Cancel match?',
        message:
          'This will mark the match as cancelled. Players will no longer be able to score or update the Playing 11 for this fixture.',
        confirmLabel: 'Cancel Match',
        onConfirm: () => run(() => setMatchState(match!.id, next)),
      });
      return;
    }
    void run(() => setMatchState(match!.id, next));
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
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <ScreenHeader />
        <View className="flex-1 justify-center px-6">
          <Text className="font-sans text-base text-on-surface-variant">{error}</Text>
        </View>
      </SafeAreaView>
    );
  }
  if (!match) return <View />;

  const state = match.state;
  const systemTeams: { id: string; name: string }[] = [];
  if (match.homeTeamId) systemTeams.push({ id: match.homeTeamId, name: match.homeTeamName ?? 'Home' });
  if (match.awayTeamId) systemTeams.push({ id: match.awayTeamId, name: match.awayTeamName ?? 'Away' });

  const scorerCanVerify = canVerifyPlayingXiForMatch(user, match);
  /** Mirrors match-setup checkbox `opponentIsAccTeam` (persisted as awayTeamId vs externalOpponentName). */
  const opponentIsAccTeam = isAccRegisteredOpponent(match);
  const externalOpponent = isExternalOpponentMatch(match);
  const xiFinalization = buildMatchPlayingXiFinalizationStatus({
    homeTeamId: match.homeTeamId,
    awayTeamId: match.awayTeamId,
    homeTeamName: match.homeTeamName ?? 'Home',
    awayTeamName: match.awayTeamName ?? match.externalOpponentName ?? 'Away',
    squads: match.squads,
    externalOpponentPlayerCount: externalOpponent ? match.externalPlayers.length : undefined,
  });
  const selectablePlayingXiTeams = systemTeams.filter(
    (team) =>
      canLockPlayingXiForTeam(user, match.tournamentId, team.id) ||
      scorerCanVerify,
  );

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

  const scoreViewAction = (() => {
    if (state === 'LIVE' || state === 'RAIN_INTERRUPTED') {
      return { label: 'View Live Score', href: `/matches/${match.id}/live` as const };
    }
    if (POST_MATCH.includes(state)) {
      return { label: 'View Scorecard', href: `/matches/${match.id}/scorecard` as const };
    }
    return null;
  })();

  function resolvePlayingXiRoute(team: { id: string; name: string }): string {
    if (match.ballType === BallType.Leather) {
      return `/matches/${match.id}/confirm-playing-xi?teamId=${team.id}&teamName=${encodeURIComponent(team.name)}`;
    }
    if (scorerCanVerify && !canLockPlayingXiForTeam(user, match.tournamentId, team.id)) {
      return `/matches/${match.id}/verify-playing-xi?teamId=${team.id}&teamName=${encodeURIComponent(team.name)}`;
    }
    return `/matches/${match.id}/playing-xi?teamId=${team.id}&teamName=${encodeURIComponent(team.name)}`;
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScreenHeader />
      <ScrollView contentContainerClassName="px-6 pb-6 pt-2 gap-4">
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
        </View>

        <MatchDetailsSection match={match} />

        {error ? (
          <View className="rounded-lg bg-primary-50 px-4 py-3">
            <Text className="font-sans text-sm text-primary">{error}</Text>
          </View>
        ) : null}

        {/* Live scoring (§28) or post-match scorecard (§13, §16) */}
        {scoreViewAction ? (
          <Button
            onPress={() => router.push(scoreViewAction.href)}
            variant="secondary"
            className="h-12"
            label={scoreViewAction.label}
          />
        ) : null}

        {(state === 'COMPLETED' || state === 'SCORECARD_LOCKED') ? (
          <MatchManOfMatchBlock
            matchId={match.id}
            match={match}
            actionStyle="inline"
          />
        ) : null}

        {canViewMatchPlayersPunchTimeButton(user, match) ? (
          <Button
            onPress={() => router.push(`/matches/${match.id}/punch-time`)}
            variant="secondary"
            className="h-12"
            label="Players Punch Time"
          />
        ) : null}

        {/* Playing 11 lock (§9.7) */}
        {LOCKABLE.includes(state) && (selectablePlayingXiTeams.length > 0 || externalOpponent) ? (
          <View className="gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
            <Text className="font-sans-bold text-lg text-primary">Playing 11</Text>
            <Text className="font-sans text-sm text-on-surface-variant">
              {externalOpponent
                ? `Confirm your team's 11 starters and add ${PLAYING_XI_SIZE} opponent player names before the match goes live.`
                : 'Confirm exactly 11 starters per team (substitutes optional) before the match goes live.'}
            </Text>
            {selectablePlayingXiTeams.map((t) => {
              const squad = match.squads.find((s) => s.teamId === t.id);
              const finalized = Boolean(squad?.isFinalized);
              return (
                <Button
                  key={t.id}
                  onPress={() => router.push(resolvePlayingXiRoute(t))}
                  variant="outline"
                  className="h-12 flex-row justify-between border-primary px-4"
                >
                  <Text className="font-sans-semibold text-sm text-primary">
                    {finalized ? 'Edit' : 'Confirm'} Playing 11 · {t.name}
                  </Text>
                  {finalized ? (
                    <Text className="font-sans text-xs text-primary">Finalized ✓</Text>
                  ) : null}
                </Button>
              );
            })}
            {externalOpponent && scorerCanVerify ? (
              <Button
                onPress={() => router.push(`/matches/${match.id}/opponent-players`)}
                className="h-12"
                label={
                  xiFinalization.awayTeamFinalized
                    ? `Opponent Players (${PLAYING_XI_SIZE}/${PLAYING_XI_SIZE})`
                    : `Add Opponent Team Players (${match.externalPlayers.length}/${PLAYING_XI_SIZE})`
                }
              />
            ) : null}
            {scorerCanVerify &&
            opponentIsAccTeam &&
            !xiFinalization.homeTeamFinalized &&
            !xiFinalization.awayTeamFinalized ? (
              <Button
                onPress={() => router.push(`/matches/${match.id}/verify-playing-xi`)}
                className="h-12"
                label="Verify Both Teams' Playing 11"
              />
            ) : null}
          </View>
        ) : null}

        {externalOpponent && match.externalPlayers.length > 0 ? (
          <View className="gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
            <Text className="font-sans-bold text-lg text-primary">
              {match.externalOpponentName ?? 'Opponent'} XI
            </Text>
            {[...match.externalPlayers]
              .sort((a, b) => a.slot - b.slot)
              .map((player) => (
                <Text key={player.id} className="font-sans text-sm text-on-surface">
                  {player.name}
                </Text>
              ))}
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
            {squad.penaltyServing.map((p) => (
              <View key={`penalty-${p.userId}`} className="flex-row items-center justify-between">
                <Text className="font-sans text-sm text-on-surface">
                  {p.firstName} {p.lastName}
                </Text>
                <Text className="font-sans-medium text-[10px] uppercase tracking-wider text-on-surface-variant">
                  Penalty Serving
                </Text>
              </View>
            ))}
          </View>
        ))}

        {/* Toss (§11.2) — tennis: assigned match scorer + organizers; leather: existing rule */}
        {canShowRecordToss(user, match) ? (
          <Button
            onPress={() => router.push(`/matches/${match.id}/toss`)}
            className="h-12"
            label="Record Toss"
          />
        ) : null}

        {/* Scorer assignment (§11.1) */}
        {match.tennisScorer ? (
          <MatchTennisScorerSection
            matchId={match.id}
            tournamentId={match.tournamentId}
            tennisScorer={match.tennisScorer}
            working={working}
            onAssign={async (userId) => {
              await run(() => assignScorer(match.id, { userId }));
            }}
            onScorerSwapped={() => void load()}
          />
        ) : lockedUserIds.size > 0 ? (
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
                  onPress={() => handleStateTransition(next)}
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

      <DelayMatchDialog
        visible={delayDialogVisible}
        working={working}
        onClose={() => setDelayDialogVisible(false)}
        onApply={async (delayMinutes) => {
          await run(async () => {
            const updated = await delayMatch(match!.id, { delayMinutes });
            setDelayDialogVisible(false);
            return updated;
          });
        }}
      />
    </SafeAreaView>
  );
}
