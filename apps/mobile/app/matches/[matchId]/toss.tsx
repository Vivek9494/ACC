import { type MatchDetail, type MatchSide, type TossDecision } from '@acc/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader';
import { Button } from '../../../src/components/ui/Button';
import { Text } from '../../../src/components/ui/Text';
import { FIELD_ORANGE } from '../../../src/components/ui/fieldStyles';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiRequestError, getMatch, startScoring } from '../../../src/lib/api';

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
      await startScoring(matchId, { tossWinner: winner, decision });
      router.push(`/matches/${matchId}/score`);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not start scoring.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={FIELD_ORANGE} />
      </SafeAreaView>
    );
  }
  if (!match) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <ScreenHeader title="Match Setup" onBack={() => router.back()} />
        <View className="flex-1 px-6 py-12">
          <Text className="font-sans text-base text-on-surface-variant">
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
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScreenHeader title="Match Setup" onBack={() => router.back()} />
      <ScrollView contentContainerClassName="px-6 py-6 gap-6">
        {error ? (
          <View className="rounded-lg bg-primary-50 px-4 py-3">
            <Text className="font-sans text-sm text-primary">{error}</Text>
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
