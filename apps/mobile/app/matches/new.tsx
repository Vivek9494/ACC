import { type CreateMatchRequest, type TournamentDetail } from '@acc/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Button } from '../../src/components/ui/Button';
import { Text } from '../../src/components/ui/Text';
import { TextInput } from '../../src/components/ui/TextInput';
import { FIELD_ORANGE } from '../../src/components/ui/fieldStyles';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OptionSelector } from '../../src/components/OptionSelector';
import { ApiRequestError, createMatch, getTournament } from '../../src/lib/api';

type OpponentMode = 'TEAM' | 'EXTERNAL';

export default function NewMatchScreen(): React.ReactElement {
  const { tournamentId } = useLocalSearchParams<{ tournamentId: string }>();
  const router = useRouter();

  const [tournament, setTournament] = useState<TournamentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [homeTeamId, setHomeTeamId] = useState<string | null>(null);
  const [opponentMode, setOpponentMode] = useState<OpponentMode>('TEAM');
  const [awayTeamId, setAwayTeamId] = useState<string | null>(null);
  const [externalOpponentName, setExternalOpponentName] = useState('');
  const [matchCode, setMatchCode] = useState('');
  const [groundLocation, setGroundLocation] = useState('');

  const load = useCallback(async () => {
    if (!tournamentId) return;
    setLoading(true);
    try {
      const t = await getTournament(tournamentId);
      setTournament(t);
      // ACC matches default to an external opponent (§9.5).
      setOpponentMode(t.type === 'ACC' ? 'EXTERNAL' : 'TEAM');
      setError(null);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load tournament.');
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const teamOptions = (tournament?.teams ?? []).map((t) => ({ value: t.id, label: t.name }));
  const awayTeamOptions = teamOptions.filter((o) => o.value !== homeTeamId);

  async function submit(): Promise<void> {
    if (!tournamentId) return;
    if (!homeTeamId) {
      setError('Select a home team.');
      return;
    }
    if (opponentMode === 'TEAM' && !awayTeamId) {
      setError('Select an away team.');
      return;
    }
    if (opponentMode === 'EXTERNAL' && externalOpponentName.trim().length === 0) {
      setError('Enter the opponent name.');
      return;
    }
    const body: CreateMatchRequest = {
      homeTeamId,
      awayTeamId: opponentMode === 'TEAM' ? awayTeamId : null,
      externalOpponentName: opponentMode === 'EXTERNAL' ? externalOpponentName.trim() : null,
      matchCode: matchCode.trim() || null,
      groundLocation: groundLocation.trim() || null,
    };
    setSaving(true);
    try {
      const match = await createMatch(tournamentId, body);
      router.replace(`/matches/${match.id}`);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not create match.');
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

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="px-6 py-6 gap-5">
        <Pressable onPress={() => router.back()}>
          <Text className="font-sans text-primary">← Back</Text>
        </Pressable>
        <Text className="font-sans-bold text-2xl text-on-surface">New Match Setup</Text>
        {tournament ? (
          <Text className="font-sans text-sm text-on-surface-variant">
            Tournament: {tournament.name}
          </Text>
        ) : null}

        {error ? (
          <View className="rounded-lg bg-primary-50 px-4 py-3">
            <Text className="font-sans text-sm text-primary">{error}</Text>
          </View>
        ) : null}

        <OptionSelector
          label="Home Team"
          options={teamOptions}
          value={homeTeamId}
          onChange={(v) => {
            setHomeTeamId(v);
            if (v === awayTeamId) setAwayTeamId(null);
          }}
        />

        <OptionSelector<OpponentMode>
          label="Opponent"
          options={[
            { value: 'TEAM', label: 'Tournament Team' },
            { value: 'EXTERNAL', label: 'External Team' },
          ]}
          value={opponentMode}
          onChange={setOpponentMode}
        />

        {opponentMode === 'TEAM' ? (
          <OptionSelector
            label="Away Team"
            options={awayTeamOptions}
            value={awayTeamId}
            onChange={setAwayTeamId}
          />
        ) : (
          <View className="gap-2">
            <Text className="font-sans-medium text-xs uppercase tracking-wider text-on-surface-variant">
              Opponent Name
            </Text>
            <TextInput
              value={externalOpponentName}
              onChangeText={setExternalOpponentName}
              placeholder="e.g. Scarborough Strikeforce"
              className="border border-outline-variant bg-surface-container-lowest px-4 py-3 text-on-surface"
            />
          </View>
        )}

        <View className="gap-2">
          <Text className="font-sans-medium text-xs uppercase tracking-wider text-on-surface-variant">
            Match Code (optional)
          </Text>
          <TextInput
            value={matchCode}
            onChangeText={setMatchCode}
            placeholder="e.g. M14"
            className="border border-outline-variant bg-surface-container-lowest px-4 py-3 text-on-surface"
          />
        </View>

        <View className="gap-2">
          <Text className="font-sans-medium text-xs uppercase tracking-wider text-on-surface-variant">
            Ground Location (optional)
          </Text>
          <TextInput
            value={groundLocation}
            onChangeText={setGroundLocation}
            placeholder="Ground / venue"
            className="border border-outline-variant bg-surface-container-lowest px-4 py-3 text-on-surface"
          />
        </View>

        <Button
          disabled={saving}
          onPress={() => void submit()}
          variant="secondary"
          className="mt-2 h-12"
          textClassName="text-base"
          label={saving ? 'Creating…' : 'Create Match'}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
