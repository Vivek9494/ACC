import { Ionicons } from '@expo/vector-icons';
import type { BowlerPickerResponse } from '@acc/types';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddExternalBowlerDialog } from './AddExternalBowlerDialog';
import { BowlerPickerRow } from './BowlerPickerRow';
import { Button } from '../ui/Button';
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

export function SelectBowlerScreen({
  matchId,
  inningsId,
  selectedBowlerId = null,
}: SelectBowlerScreenProps): React.ReactElement {
  const router = useRouter();
  const [data, setData] = useState<BowlerPickerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddExternal, setShowAddExternal] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
      <View className="flex-row items-center justify-between px-4 pb-2 pt-1">
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-full active:bg-black/5"
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="arrow-back" size={24} color={FIELD_ORANGE} />
          </Pressable>
          <Text className="font-sans-bold text-xl text-primary">Select Bowler</Text>
        </View>
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
      </View>

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
          <ScrollView
            contentContainerClassName={`gap-4 px-4 pt-2 ${isExternalSide ? 'pb-32' : 'pb-8'}`}
          >
            <View>
              <Text className="font-sans-semibold text-xs uppercase tracking-wider text-on-surface-variant">
                Bowling Team
              </Text>
              <View className="mt-1 flex-row flex-wrap items-center gap-3">
                <Text className="font-sans-bold text-2xl text-primary">{data.bowlingTeamName}</Text>
                {!isExternalSide ? (
                  <View className="rounded-full bg-primary-container px-3 py-1">
                    <Text className="font-sans-semibold text-sm text-on-primary-container">
                      Playing 11
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {filteredPlayers.length === 0 ? (
              <View className="rounded-control border border-outline-variant bg-surface p-4">
                <Text className="font-sans text-sm text-on-surface-variant">
                  {isExternalSide
                    ? 'No bowlers added yet. Use Add New Bowler to enter opponent players by name as they bowl.'
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
                  />
                ))}
              </View>
            )}
          </ScrollView>

          {isExternalSide ? (
            <View className="absolute bottom-0 left-0 right-0 border-t border-outline-variant bg-background px-4 pb-8 pt-4">
              <Button
                label="Add New Bowler"
                onPress={() => setShowAddExternal(true)}
                className="h-12"
              />
            </View>
          ) : null}

          <AddExternalBowlerDialog
            visible={showAddExternal}
            matchId={matchId}
            inningsId={inningsId}
            onCancel={() => setShowAddExternal(false)}
            onAdded={() => {
              setShowAddExternal(false);
              void load();
            }}
          />
        </>
      ) : null}
    </SafeAreaView>
  );
}
