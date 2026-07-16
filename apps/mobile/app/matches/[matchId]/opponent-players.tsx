import { PLAYING_XI_SIZE, type ExternalPlayerView } from '@acc/types';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../../src/components/ui/Button';
import { KeyboardAwareFormScrollView } from '../../../src/components/ui/KeyboardAwareFormScrollView';
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader';
import { TextInput } from '../../../src/components/ui/TextInput';
import { Text } from '../../../src/components/ui/Text';
import { FIELD_ORANGE } from '../../../src/components/ui/fieldStyles';
import { addOpponentPlayer, ApiRequestError, getMatch, removeOpponentPlayer } from '../../../src/lib/api';

/** Pre-match manual roster for an external opponent (ACC §9.5). */
export default function OpponentPlayersScreen(): React.ReactElement {
  const router = useRouter();
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const [opponentName, setOpponentName] = useState('');
  const [players, setPlayers] = useState<ExternalPlayerView[]>([]);
  const [externalTeamLabel, setExternalTeamLabel] = useState('Opponent');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!matchId) {
      setError('Match not found.');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const match = await getMatch(matchId);
      setExternalTeamLabel(match.externalOpponentName?.trim() || 'Opponent');
      setPlayers([...match.externalPlayers].sort((a, b) => a.slot - b.slot));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load opponent players.');
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    void load();
  }, [load]);

  const atCapacity = players.length >= PLAYING_XI_SIZE;
  const countLabel = `${players.length}/${PLAYING_XI_SIZE}`;

  async function handleAdd(): Promise<void> {
    if (!matchId || atCapacity) {
      return;
    }
    const trimmed = opponentName.trim();
    if (!trimmed) {
      setError('Enter a player name.');
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const created = await addOpponentPlayer(matchId, trimmed);
      setPlayers((current) => [...current, created].sort((a, b) => a.slot - b.slot));
      setOpponentName('');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not add player.');
    } finally {
      setAdding(false);
    }
  }

  function confirmRemove(player: ExternalPlayerView): void {
    Alert.alert('Remove player?', player.name, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          if (!matchId) {
            return;
          }
          setRemovingId(player.id);
          void removeOpponentPlayer(matchId, player.id)
            .then((updated) => {
              setPlayers([...updated.externalPlayers].sort((a, b) => a.slot - b.slot));
            })
            .catch((err: unknown) => {
              setError(
                err instanceof ApiRequestError ? err.message : 'Could not remove player.',
              );
            })
            .finally(() => setRemovingId(null));
        },
      },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScreenHeader title="Opponent Players" onBack={() => router.back()} />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={FIELD_ORANGE} />
        </View>
      ) : (
        <KeyboardAwareFormScrollView
          className="flex-1"
          contentContainerClassName="gap-4 px-4 py-4"
          extraBottomPadding={40}
        >
          <Text className="font-sans-semibold text-base text-on-surface">{externalTeamLabel}</Text>
          <Text className="font-sans text-sm text-on-surface-variant">
            Add up to {PLAYING_XI_SIZE} opponent player names. {countLabel} added
            {atCapacity ? ' — roster full.' : '.'}
          </Text>

          {error ? (
            <View className="rounded-lg bg-primary-50 px-4 py-3">
              <Text className="font-sans text-sm text-primary">{error}</Text>
            </View>
          ) : null}

          <View className="gap-3">
            <TextInput
              label="Player name"
              value={opponentName}
              onChangeText={setOpponentName}
              placeholder="Enter opponent player name"
              editable={!atCapacity && !adding}
            />
            <Button
              label={atCapacity ? `${PLAYING_XI_SIZE}/${PLAYING_XI_SIZE} added` : 'Add'}
              onPress={() => void handleAdd()}
              disabled={atCapacity || adding}
              className="h-12 w-full"
            />
          </View>

          {players.length > 0 ? (
            <View className="mt-4 gap-2">
              {players.map((player) => (
                <View
                  key={player.id}
                  className="flex-row items-center justify-between rounded-control border border-outline-variant/30 bg-surface-container-lowest px-4 py-3"
                >
                  <Text className="min-w-0 flex-1 font-sans-semibold text-base text-on-surface">
                    {player.name}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${player.name}`}
                    disabled={removingId === player.id}
                    onPress={() => confirmRemove(player)}
                    className="ml-2 p-1 active:opacity-70"
                  >
                    <Ionicons name="close-circle" size={22} color={FIELD_ORANGE} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : (
            <Text className="py-8 text-center font-sans text-sm text-on-surface-variant">
              No opponent players added yet.
            </Text>
          )}
        </KeyboardAwareFormScrollView>
      )}
    </SafeAreaView>
  );
}
