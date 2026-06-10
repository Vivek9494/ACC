import type {
  MatchDetail,
  ScorecardConfirmationView,
  ScorecardResponse,
  SquadPlayerView,
} from '@acc/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, View } from 'react-native';
import { Button } from '../../../src/components/ui/Button';
import { Text } from '../../../src/components/ui/Text';
import { FIELD_ORANGE } from '../../../src/components/ui/fieldStyles';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LiveScorecard, type NameResolver } from '../../../src/components/LiveScorecard';
import {
  ApiRequestError,
  confirmScorecard,
  getMatch,
  getScorecard,
  getScorecardConfirmation,
  scorecardPdfUrl,
  selectManOfMatch,
} from '../../../src/lib/api';

function useResolvers(match: MatchDetail | null): {
  nameOf: NameResolver;
  teamNameOf: NameResolver;
} {
  return useMemo(() => {
    const players = new Map<string, string>();
    const teams = new Map<string, string>();
    if (match) {
      for (const squad of match.squads) {
        teams.set(squad.teamId, squad.teamName);
        for (const p of squad.players) players.set(p.userId, `${p.firstName} ${p.lastName}`);
      }
      if (match.homeTeamId) teams.set(match.homeTeamId, match.homeTeamName ?? 'Home');
      if (match.awayTeamId) teams.set(match.awayTeamId, match.awayTeamName ?? 'Away');
    }
    const nameOf: NameResolver = (id) => (id ? (players.get(id) ?? 'Player') : '—');
    const teamNameOf: NameResolver = (id) =>
      id ? (teams.get(id) ?? match?.externalOpponentName ?? 'Team') : 'Team';
    return { nameOf, teamNameOf };
  }, [match]);
}

/** Humanises the remaining time to the auto-confirm deadline (§13.1). */
function untilLabel(iso: string | null): string {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'now';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

/**
 * Match result & scorecard confirmation screen (spec §13, §16). Mirrors the
 * `full_scorecard_detailed_view_with_stats` mockup: the full derived scorecard,
 * a Captain/VC confirmation banner with the 5-hour auto-confirm countdown, the
 * Man of the Match picker, and a guest-accessible PDF export.
 */
export default function ScorecardResultScreen(): React.ReactElement {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();

  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [card, setCard] = useState<ScorecardResponse | null>(null);
  const [confirmation, setConfirmation] = useState<ScorecardConfirmationView | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!matchId) return;
    try {
      const [m, c, conf] = await Promise.all([
        getMatch(matchId),
        getScorecard(matchId),
        getScorecardConfirmation(matchId),
      ]);
      setMatch(m);
      setCard(c);
      setConfirmation(conf);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load the scorecard.');
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    void load();
  }, [load]);

  const { nameOf, teamNameOf } = useResolvers(match);

  const players: SquadPlayerView[] = useMemo(
    () =>
      (match?.squads ?? []).flatMap((s) =>
        s.players.filter((p) => p.role === 'PLAYING_XI' || p.role === 'IMPACT_CANDIDATE'),
      ),
    [match],
  );

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator color={FIELD_ORANGE} />
      </SafeAreaView>
    );
  }

  function doConfirm(): void {
    Alert.alert(
      'Confirm scorecard?',
      'Once confirmed the scorecard is locked. Captain, Vice Captain and Scorer can no longer edit it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'default',
          onPress: () => {
            setWorking(true);
            void (async () => {
              try {
                const conf = await confirmScorecard(matchId, {
                  expectedVersion: card?.version,
                });
                setConfirmation(conf);
                await load();
              } catch (err) {
                setError(err instanceof ApiRequestError ? err.message : 'Confirmation failed.');
              } finally {
                setWorking(false);
              }
            })();
          },
        },
      ],
    );
  }

  function pickManOfMatch(userId: string): void {
    setWorking(true);
    void (async () => {
      try {
        const conf = await selectManOfMatch(matchId, { userId });
        setConfirmation(conf);
      } catch (err) {
        setError(err instanceof ApiRequestError ? err.message : 'Could not set Man of the Match.');
      } finally {
        setWorking(false);
      }
    })();
  }

  const locked = confirmation?.state === 'SCORECARD_LOCKED';
  const awaiting = confirmation?.state === 'COMPLETED' || confirmation?.state === 'NO_RESULT';

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView contentContainerClassName="px-6 py-6 gap-4">
        <Pressable onPress={() => router.back()}>
          <Text className="font-sans text-primary">← Back</Text>
        </Pressable>

        <Text className="font-sans-bold text-2xl text-on-surface">
          {match
            ? `${match.homeTeamName ?? 'TBD'} vs ${match.awayTeamName ?? match.externalOpponentName ?? 'TBD'}`
            : 'Scorecard'}
        </Text>

        {error ? (
          <View className="rounded-lg bg-error-container px-4 py-3">
            <Text className="font-sans text-sm text-on-error-container">{error}</Text>
          </View>
        ) : null}

        {/* §13.1: confirmation status / action */}
        {awaiting ? (
          <View className="gap-2 rounded-xl border border-primary bg-primary-container/40 p-4">
            <Text className="font-sans-bold text-lg text-primary">Confirm scorecard</Text>
            <Text className="font-sans text-sm text-on-surface-variant">
              The Captain or Vice Captain should confirm within 5 hours. Otherwise the system
              auto-confirms{confirmation?.autoConfirmDueAt ? ` in ${untilLabel(confirmation.autoConfirmDueAt)}` : ''}.
            </Text>
            <Button
              disabled={working}
              onPress={doConfirm}
              variant="secondary"
              className="h-12"
              label="Confirm scorecard"
            />
          </View>
        ) : null}

        {locked ? (
          <View className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
            <Text className="font-sans-medium text-[11px] uppercase tracking-wider text-on-surface-variant">
              Scorecard locked
            </Text>
            <Text className="mt-1 font-sans text-sm text-on-surface">
              {confirmation?.autoConfirmed
                ? 'Auto-confirmed by the system after the 5-hour window.'
                : 'Confirmed by the team.'}
            </Text>
          </View>
        ) : null}

        {/* Full scorecard (§28) */}
        {card ? <LiveScorecard state={card} nameOf={nameOf} teamNameOf={teamNameOf} /> : null}

        {/* §13.3: Man of the Match */}
        {(awaiting || locked) && players.length > 0 ? (
          <View className="gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
            <Text className="font-sans-bold text-lg text-primary">Man of the Match</Text>
            {confirmation?.manOfTheMatchUserId ? (
              <Text className="font-sans text-sm text-on-surface">
                ★ {nameOf(confirmation.manOfTheMatchUserId)}
              </Text>
            ) : (
              <Text className="font-sans text-sm text-on-surface-variant">
                Select the player of the match.
              </Text>
            )}
            <View className="gap-1.5">
              {players.map((p) => {
                const selected = confirmation?.manOfTheMatchUserId === p.userId;
                return (
                  <Button
                    key={p.userId}
                    disabled={working}
                    onPress={() => pickManOfMatch(p.userId)}
                    variant={selected ? 'primary' : 'outline'}
                    className={`h-11 flex-row justify-between px-4 ${selected ? 'border-primary bg-primary-container/40' : ''}`}
                  >
                    <Text className="font-sans text-sm text-on-surface">
                      {p.firstName} {p.lastName}
                    </Text>
                    {selected ? <Text className="font-sans text-xs text-primary">Selected ★</Text> : null}
                  </Button>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* §16: PDF export (guest-accessible) */}
        <Button
          onPress={() => void Linking.openURL(scorecardPdfUrl(matchId))}
          variant="outline"
          className="h-12 border-primary"
          textClassName="text-primary"
          label="Export scorecard PDF"
        />
      </ScrollView>
    </SafeAreaView>
  );
}
