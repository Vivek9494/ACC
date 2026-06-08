import { type MatchDetail, type MatchSide, type TossDecision } from '@acc/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Button } from '../../../src/components/ui/Button';
import { Text } from '../../../src/components/ui/Text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiRequestError, getMatch, recordToss, setMatchState } from '../../../src/lib/api';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w.slice(0, 1))
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function TossScreen(): React.ReactElement {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();

  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [winner, setWinner] = useState<MatchSide | null>(null);
  const [decision, setDecision] = useState<TossDecision | null>(null);

  const load = useCallback(async () => {
    if (!matchId) return;
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

  async function start(): Promise<void> {
    if (!matchId || !winner || !decision) {
      setError('Select the toss winner and decision.');
      return;
    }
    setSaving(true);
    try {
      await recordToss(matchId, { tossWinner: winner, decision });
      // §11.2: once the toss is captured the Scorer can begin — move to Live.
      await setMatchState(matchId, 'LIVE');
      router.back();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not record the toss.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator color="#a04100" />
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

  const teamA = match.homeTeamName ?? 'Home';
  const teamB = match.awayTeamName ?? match.externalOpponentName ?? 'Away';
  const sides: { side: MatchSide; name: string }[] = [
    { side: 'TEAM_A', name: teamA },
    { side: 'TEAM_B', name: teamB },
  ];

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView contentContainerClassName="px-6 py-6 gap-6">
        <Pressable onPress={() => router.back()}>
          <Text className="font-sans text-primary">← Back</Text>
        </Pressable>
        <Text className="font-sans-bold text-2xl text-on-surface">Match Setup</Text>

        {error ? (
          <View className="rounded-lg bg-error-container px-4 py-3">
            <Text className="font-sans text-sm text-on-error-container">{error}</Text>
          </View>
        ) : null}

        {/* Who won the toss? */}
        <View className="gap-3">
          <Text className="font-sans-medium text-xs uppercase tracking-wider text-on-surface-variant">
            Who won the toss?
          </Text>
          <View className="flex-row gap-3">
            {sides.map((s) => {
              const active = winner === s.side;
              return (
                <Button
                  key={s.side}
                  onPress={() => setWinner(s.side)}
                  variant={active ? 'primary' : 'outline'}
                  className={`flex-1 gap-2 p-4 ${active ? 'border-primary' : 'bg-surface-container-lowest'}`}
                >
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-surface-container-high">
                    <Text className="font-sans-bold text-on-surface-variant">
                      {initials(s.name)}
                    </Text>
                  </View>
                  <Text
                    className={`text-center font-sans-semibold text-sm ${
                      active ? 'text-on-primary' : 'text-on-surface'
                    }`}
                  >
                    {s.name}
                  </Text>
                </Button>
              );
            })}
          </View>
        </View>

        {/* Choose to */}
        <View className="gap-3">
          <Text className="font-sans-medium text-xs uppercase tracking-wider text-on-surface-variant">
            Choose to
          </Text>
          <View className="flex-row gap-3">
            {(['BAT', 'BOWL'] as TossDecision[]).map((d) => {
              const active = decision === d;
              return (
                <Button
                  key={d}
                  onPress={() => setDecision(d)}
                  variant={active ? 'primary' : 'outline'}
                  className={`flex-1 py-4 ${active ? 'border-primary' : 'bg-surface-container-lowest'}`}
                  textClassName={`text-base ${active ? 'text-on-primary' : 'text-on-surface'}`}
                  label={d === 'BAT' ? 'Bat' : 'Bowl'}
                />
              );
            })}
          </View>
        </View>

        <Button
          disabled={saving || !winner || !decision}
          onPress={() => void start()}
          variant="secondary"
          className="h-12"
          textClassName="text-base"
          label={saving ? 'Starting…' : 'Start Scoring'}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
