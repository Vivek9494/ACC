import {
  DeliveryType,
  DismissalType,
  type MatchDetail,
  type RecordDeliveryRequest,
  type ScorecardResponse,
  type SquadPlayerView,
} from '@acc/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Button } from '../../../src/components/ui/Button';
import { Text } from '../../../src/components/ui/Text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LiveScorecard, type NameResolver } from '../../../src/components/LiveScorecard';
import {
  ApiRequestError,
  getMatch,
  getScorecard,
  recordDelivery,
  startInnings,
} from '../../../src/lib/api';

type WicketChoice =
  | { label: string; dismissal: DismissalType }
  | { label: string; deliveryType: typeof DeliveryType.RetiredHurt | typeof DeliveryType.RetiredOut };

// Dismissal modes in scope (spec §12.1); out-of-scope modes (§30.3) are absent.
const WICKET_CHOICES: WicketChoice[] = [
  { label: 'Bowled', dismissal: DismissalType.Bowled },
  { label: 'Caught', dismissal: DismissalType.Caught },
  { label: 'LBW', dismissal: DismissalType.Lbw },
  { label: 'Run Out', dismissal: DismissalType.RunOut },
  { label: 'Stumped', dismissal: DismissalType.Stumped },
  { label: 'Hit Wicket', dismissal: DismissalType.HitWicket },
  { label: 'Retired Hurt', deliveryType: DeliveryType.RetiredHurt },
  { label: 'Retired Out', deliveryType: DeliveryType.RetiredOut },
];

export default function ScorerDashboardScreen(): React.ReactElement {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();

  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [card, setCard] = useState<ScorecardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [strikerId, setStrikerId] = useState<string | null>(null);
  const [nonStrikerId, setNonStrikerId] = useState<string | null>(null);
  const [bowlerId, setBowlerId] = useState<string | null>(null);
  const [picking, setPicking] = useState<'striker' | 'nonStriker' | 'bowler' | null>(null);
  const [showWicket, setShowWicket] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!matchId) return;
      try {
        const [m, c] = await Promise.all([getMatch(matchId).catch(() => null), getScorecard(matchId)]);
        if (!active) return;
        setMatch(m);
        setCard(c);
      } catch (err) {
        if (active) setError(err instanceof ApiRequestError ? err.message : 'Could not load match.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [matchId]);

  const inn = card?.innings.at(-1) ?? null;

  const { nameOf, teamNameOf } = useMemo(() => {
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

  const battingSquad: SquadPlayerView[] = useMemo(
    () => match?.squads.find((s) => s.teamId === inn?.battingTeamId)?.players ?? [],
    [match, inn?.battingTeamId],
  );
  const bowlingSquad: SquadPlayerView[] = useMemo(
    () => match?.squads.find((s) => s.teamId === inn?.bowlingTeamId)?.players ?? [],
    [match, inn?.bowlingTeamId],
  );

  function syncStrike(updated: ScorecardResponse): void {
    const live = updated.innings.at(-1);
    if (live) {
      setStrikerId(live.currentStrikerId);
      setNonStrikerId(live.currentNonStrikerId);
    }
  }

  async function begin(): Promise<void> {
    if (!matchId || !match) return;
    setWorking(true);
    try {
      const updated = await startInnings(matchId, {
        battingTeamId: match.homeTeamId ?? null,
        bowlingTeamId: match.awayTeamId ?? null,
        bowlingIsExternal: !match.awayTeamId,
        expectedVersion: card?.version ?? 0,
      });
      setCard(updated);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not start the innings.');
    } finally {
      setWorking(false);
    }
  }

  async function record(body: Omit<RecordDeliveryRequest, 'expectedVersion'>): Promise<void> {
    if (!matchId || !card || !inn?.inningsId) return;
    if (!strikerId || !nonStrikerId || !bowlerId) {
      setError('Select striker, non-striker and bowler before scoring.');
      return;
    }
    setWorking(true);
    try {
      const updated = await recordDelivery(matchId, inn.inningsId, {
        ...body,
        strikerId,
        nonStrikerId,
        bowlerId,
        expectedVersion: card.version,
      });
      setCard(updated);
      syncStrike(updated);
      setError(null);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
        // §12.3: a stale save was rejected — resync to the server's version.
        if (err.status === 409) {
          const fresh = await getScorecard(matchId);
          setCard(fresh);
          syncStrike(fresh);
        }
      } else {
        setError('Could not record the ball.');
      }
    } finally {
      setWorking(false);
    }
  }

  function chooseWicket(choice: WicketChoice): void {
    setShowWicket(false);
    if ('dismissal' in choice) {
      void record({ type: DeliveryType.Legal, runsBat: 0, dismissal: { type: choice.dismissal, dismissedId: strikerId } });
    } else {
      void record({ type: choice.deliveryType, dismissal: { type: DismissalType.RetiredOut, dismissedId: strikerId } });
    }
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator color="#a04100" />
      </SafeAreaView>
    );
  }

  const pickList = picking === 'bowler' ? bowlingSquad : battingSquad;
  const onPick = (userId: string): void => {
    if (picking === 'striker') setStrikerId(userId);
    else if (picking === 'nonStriker') setNonStrikerId(userId);
    else if (picking === 'bowler') setBowlerId(userId);
    setPicking(null);
  };

  const runButtons = [0, 1, 2, 3, 4, 6];

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView contentContainerClassName="px-5 py-6 gap-4">
        <View className="flex-row items-center justify-between">
          <Pressable onPress={() => router.back()}>
            <Text className="font-sans text-primary">← Back</Text>
          </Pressable>
          <Pressable onPress={() => router.push(`/matches/${matchId}/live`)}>
            <Text className="font-sans text-xs text-on-surface-variant">View as guest →</Text>
          </Pressable>
        </View>

        <Text className="font-sans-bold text-2xl text-on-surface">Scoring</Text>

        {error ? (
          <View className="rounded-lg bg-error-container px-4 py-3">
            <Text className="font-sans text-sm text-on-error-container">{error}</Text>
          </View>
        ) : null}

        {!inn ? (
          <Button
            disabled={working}
            onPress={() => void begin()}
            variant="secondary"
            className="h-12"
            label="Start Innings"
          />
        ) : (
          <>
            {/* On-strike / bowler selectors */}
            <View className="gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
              {(
                [
                  ['striker', 'Striker', strikerId],
                  ['nonStriker', 'Non-striker', nonStrikerId],
                  ['bowler', 'Bowler', bowlerId],
                ] as const
              ).map(([role, label, id]) => (
                <Button
                  key={role}
                  onPress={() => setPicking((p) => (p === role ? null : role))}
                  variant="outline"
                  className="h-11 flex-row justify-between px-4"
                >
                  <Text className="font-sans-medium text-[11px] uppercase tracking-wider text-on-surface-variant">
                    {label}
                  </Text>
                  <Text className="font-sans-semibold text-sm text-on-surface">
                    {id ? nameOf(id) : 'Select'}
                  </Text>
                </Button>
              ))}

              {picking ? (
                <View className="gap-1 rounded-lg bg-surface p-2">
                  {pickList.length === 0 ? (
                    <Text className="px-2 py-1 font-sans text-xs text-on-surface-variant">
                      No squad players available (external side).
                    </Text>
                  ) : (
                    pickList.map((p) => (
                      <Button
                        key={p.userId}
                        onPress={() => onPick(p.userId)}
                        variant="outline"
                        className="h-10 justify-center border-0 bg-transparent px-3 active:bg-primary-container"
                      >
                        <Text className="font-sans text-sm text-on-surface">
                          {p.firstName} {p.lastName}
                        </Text>
                      </Button>
                    ))
                  )}
                </View>
              ) : null}
            </View>

            {/* Quick scoring pad (matches live_match_dashboard) */}
            <View className="gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
              <Text className="font-sans-medium text-xs uppercase tracking-wider text-primary">
                Quick Scoring
              </Text>
              <View className="flex-row flex-wrap gap-3">
                {runButtons.map((r) => (
                  <Button
                    key={r}
                    disabled={working}
                    onPress={() =>
                      void record({ type: DeliveryType.Legal, runsBat: r, isBoundary: r === 4 || r === 6 })
                    }
                    variant={r === 4 ? 'secondary' : 'outline'}
                    className={`h-16 flex-1 basis-[28%] ${
                      r === 4 ? 'bg-primary' : r === 6 ? 'border-0 bg-[#f5a623]' : 'bg-surface'
                    }`}
                  >
                    <Text
                      className={`font-sans-bold text-2xl ${r === 4 || r === 6 ? 'text-on-primary' : 'text-on-surface'}`}
                    >
                      {r}
                    </Text>
                  </Button>
                ))}
              </View>

              <View className="flex-row gap-3">
                <Button
                  disabled={working}
                  onPress={() => setShowWicket(true)}
                  variant="destructive"
                  className="h-14 flex-1"
                >
                  <Text className="font-sans-bold text-lg text-[#c1121f]">W</Text>
                </Button>
                <Button
                  disabled={working}
                  onPress={() => void record({ type: DeliveryType.Wide, extraRuns: 1 })}
                  variant="outline"
                  className="h-14 flex-1 bg-surface"
                  textClassName="font-sans-semibold text-base"
                  label="Wd"
                />
                <Button
                  disabled={working}
                  onPress={() => void record({ type: DeliveryType.NoBall, extraRuns: 1 })}
                  variant="outline"
                  className="h-14 flex-1 bg-surface"
                  textClassName="font-sans-semibold text-base"
                  label="Nb"
                />
              </View>

              <View className="flex-row gap-3">
                <Button
                  disabled={working}
                  onPress={() => void record({ type: DeliveryType.Bye, extraRuns: 1 })}
                  variant="outline"
                  className="h-12 flex-1 bg-surface"
                  label="Bye"
                />
                <Button
                  disabled={working}
                  onPress={() => void record({ type: DeliveryType.LegBye, extraRuns: 1 })}
                  variant="outline"
                  className="h-12 flex-1 bg-surface"
                  label="Leg Bye"
                />
                <Button
                  disabled={working}
                  onPress={() => void record({ type: DeliveryType.PenaltyRuns, extraRuns: 5 })}
                  variant="outline"
                  className="h-12 flex-1 bg-surface"
                  label="Penalty"
                />
              </View>

              <Button
                disabled={working}
                onPress={() => {
                  setBowlerId(null);
                  setPicking('bowler');
                }}
                className="h-12"
                label="Next Over (new bowler)"
              />
            </View>

            {card ? <LiveScorecard state={card} nameOf={nameOf} teamNameOf={teamNameOf} /> : null}
          </>
        )}
      </ScrollView>

      {/* Dismissal dialog (matches live_match_dashboard wicket dialog) */}
      {showWicket ? (
        <View className="absolute inset-0 items-center justify-center bg-black/40 px-8">
          <View className="w-full gap-3 rounded-2xl bg-surface p-5">
            <Text className="font-sans-bold text-lg text-on-surface">Select Dismissal Type</Text>
            <View className="flex-row flex-wrap gap-2">
              {WICKET_CHOICES.map((c) => (
                <Button
                  key={c.label}
                  onPress={() => chooseWicket(c)}
                  variant="outline"
                  className="basis-[31%] bg-surface-container-lowest px-2 py-3 active:bg-primary-container"
                  textClassName="text-center text-xs"
                  label={c.label}
                />
              ))}
            </View>
            <Button
              onPress={() => setShowWicket(false)}
              variant="outline"
              className="h-11"
              label="Cancel"
            />
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
