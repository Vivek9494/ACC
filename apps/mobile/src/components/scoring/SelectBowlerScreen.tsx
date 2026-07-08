import { Ionicons } from '@expo/vector-icons';
import type { BowlerPickerPlayerRow, BowlerPickerResponse } from '@acc/types';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BowlerPickerRow } from './BowlerPickerRow';
import { EditExternalPlayerNameDialog } from './EditExternalPlayerNameDialog';
import { Button } from '../ui/Button';
import {
  KeyboardAwareFormContainer,
  KeyboardAwareFormScrollView,
} from '../ui/KeyboardAwareFormScrollView';
import { ScreenHeader } from '../ui/ScreenHeader';
import { Text } from '../ui/Text';
import { TextInput } from '../ui/TextInput';
import { FIELD_ORANGE } from '../ui/fieldStyles';
import { ApiRequestError, getBowlerPicker } from '../../lib/api';
import { setScoringPickResult } from '../../lib/scoring-pick-session';

export interface SelectBowlerScreenProps {
  matchId: string;
  inningsId: string;
  selectedBowlerId?: string | null;
}

interface EditTarget {
  playerId: string;
  name: string;
}

export function SelectBowlerScreen({
  matchId,
  inningsId,
  selectedBowlerId = null,
}: SelectBowlerScreenProps): React.ReactElement {
  const router = useRouter();
  const [data, setData] = useState<BowlerPickerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getBowlerPicker(matchId, inningsId);
      setData(response);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load bowlers.');
    } finally {
      setLoading(false);
    }
  }, [inningsId, matchId]);

  useEffect(() => {
    void load();
  }, [load]);

  function choose(userId: string): void {
    setScoringPickResult({ kind: 'bowler', userId });
    router.back();
  }

  function openEdit(row: BowlerPickerPlayerRow): void {
    const name = `${row.firstName} ${row.lastName}`.trim();
    setEditTarget({ playerId: row.userId, name });
  }

  const isExternalSide = data?.bowlingSideIsExternal === true;

  const filteredPlayers = useMemo(() => {
    if (!data) return [];
    const query = searchQuery.trim().toLowerCase();
    if (!query) return data.players;
    return data.players.filter((row) => {
      const fullName = `${row.firstName} ${row.lastName}`.trim().toLowerCase();
      return fullName.includes(query);
    });
  }, [data, searchQuery]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <KeyboardAwareFormContainer className="flex-1">
      <ScreenHeader
        title={data ? `${data.bowlingTeamName} - Bowling Team` : undefined}
        subtitle={data ? 'Select Bowler' : undefined}
        accentTitle={data != null}
        onBack={() => router.back()}
        trailing={
          <Pressable
            onPress={() => {
              setSearchOpen((open) => !open);
              if (searchOpen) setSearchQuery('');
            }}
            className="h-10 w-10 items-center justify-center rounded-full active:bg-black/5"
            accessibilityRole="button"
            accessibilityLabel="Search bowlers"
          >
            <Ionicons name="search" size={24} color={FIELD_ORANGE} />
          </Pressable>
        }
      />

      {searchOpen ? (
        <View className="px-4 pb-2">
          <TextInput
            label="Search"
            placeholder="Filter by name"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="words"
            autoFocus
          />
        </View>
      ) : null}

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={FIELD_ORANGE} />
        </View>
      ) : error ? (
        <View className="flex-1 px-4">
          <View className="rounded-control bg-primary-50 px-4 py-3">
            <Text className="font-sans text-sm text-primary">{error}</Text>
          </View>
          <Button label="Retry" onPress={() => void load()} className="mt-4 h-11" />
        </View>
      ) : data ? (
        <>
          <KeyboardAwareFormScrollView
            contentContainerClassName="gap-4 px-4 pt-2 pb-8"
            extraBottomPadding={32}
          >
            {filteredPlayers.length === 0 ? (
              <View className="rounded-control border border-outline-variant bg-surface p-4">
                <Text className="font-sans text-sm text-on-surface-variant">
                  {isExternalSide
                    ? 'No opponent players on this match yet. Add them from the opponent players list before or during setup.'
                    : 'No players available. Lock the Playing 11 before the match.'}
                </Text>
              </View>
            ) : (
              <View className="gap-3">
                {filteredPlayers.map((row) => (
                  <BowlerPickerRow
                    key={row.userId}
                    row={row}
                    selectedBowlerId={selectedBowlerId}
                    onPress={choose}
                    onEdit={isExternalSide ? openEdit : undefined}
                  />
                ))}
              </View>
            )}
          </KeyboardAwareFormScrollView>

          <EditExternalPlayerNameDialog
            visible={editTarget != null}
            matchId={matchId}
            playerId={editTarget?.playerId ?? null}
            initialName={editTarget?.name ?? ''}
            onCancel={() => setEditTarget(null)}
            onSaved={() => {
              setEditTarget(null);
              void load();
            }}
          />
        </>
      ) : null}
      </KeyboardAwareFormContainer>
    </SafeAreaView>
  );
}
