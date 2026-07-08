import {
  type BatsmanPickerPlayerRow,
  type BatsmanPickerResponse,
  BatsmanPickerRole,
  type BatsmanPickerRole as BatsmanPickerRoleValue,
} from '@acc/types';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddExternalBatsmanDialog } from './AddExternalBatsmanDialog';
import { BatsmanPickerRow } from './BatsmanPickerRow';
import { EditExternalPlayerNameDialog } from './EditExternalPlayerNameDialog';
import { Button } from '../ui/Button';
import { ScreenHeader } from '../ui/ScreenHeader';
import { Text } from '../ui/Text';
import { FIELD_ORANGE } from '../ui/fieldStyles';
import { ApiRequestError, getBatsmanPicker } from '../../lib/api';
import { setScoringPickResult, type IncomingCreaseSlot } from '../../lib/scoring-pick-session';

export interface SelectBatsmanScreenProps {
  matchId: string;
  inningsId: string;
  role: BatsmanPickerRoleValue;
  otherSlotUserId?: string | null;
  incomingSlot?: IncomingCreaseSlot | null;
}

interface EditTarget {
  playerId: string;
  name: string;
}

export function SelectBatsmanScreen({
  matchId,
  inningsId,
  role,
  otherSlotUserId = null,
  incomingSlot = null,
}: SelectBatsmanScreenProps): React.ReactElement {
  const router = useRouter();
  const [data, setData] = useState<BatsmanPickerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddExternal, setShowAddExternal] = useState(false);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getBatsmanPicker(matchId, inningsId, {
        role,
        otherSlotUserId,
      });
      setData(response);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load batters.');
    } finally {
      setLoading(false);
    }
  }, [inningsId, matchId, otherSlotUserId, role]);

  useEffect(() => {
    void load();
  }, [load]);

  function choose(userId: string): void {
    setScoringPickResult({
      kind: 'batsman',
      role,
      userId,
      incomingSlot: incomingSlot ?? undefined,
    });
    router.back();
  }

  function openEdit(row: BatsmanPickerPlayerRow): void {
    const name = `${row.firstName} ${row.lastName}`.trim();
    setEditTarget({ playerId: row.userId, name });
  }

  const isExternalSide = data?.battingSideIsExternal === true;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScreenHeader title="Select Batsman" accentTitle onBack={() => router.back()} />

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
                Batting Team
              </Text>
              <View className="mt-1 flex-row flex-wrap items-center gap-3">
                <Text className="font-sans-bold text-2xl text-on-surface">{data.battingTeamName}</Text>
                {!isExternalSide ? (
                  <View className="rounded-full bg-primary-container px-3 py-1">
                    <Text className="font-sans-semibold text-sm text-on-primary-container">
                      Playing 11
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {data.players.length === 0 ? (
              <View className="rounded-control border border-outline-variant bg-surface p-4">
                <Text className="font-sans text-sm text-on-surface-variant">
                  {isExternalSide
                    ? 'No batters added yet. Use Add New Batsman to enter opponent players by name as they come in.'
                    : 'No players available. Lock the Playing 11 before the match.'}
                </Text>
              </View>
            ) : (
              <View className="gap-3">
                {data.players.map((row) => (
                  <BatsmanPickerRow
                    key={row.userId}
                    row={row}
                    onPress={choose}
                    onEdit={isExternalSide ? openEdit : undefined}
                  />
                ))}
              </View>
            )}
          </ScrollView>

          {isExternalSide ? (
            <View className="absolute bottom-0 left-0 right-0 border-t border-outline-variant bg-background px-4 pb-8 pt-4">
              <Button
                label="Add New Batsman"
                onPress={() => setShowAddExternal(true)}
                className="h-12"
              />
            </View>
          ) : null}

          <AddExternalBatsmanDialog
            visible={showAddExternal}
            matchId={matchId}
            inningsId={inningsId}
            onCancel={() => setShowAddExternal(false)}
            onAdded={() => {
              setShowAddExternal(false);
              void load();
            }}
          />

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
    </SafeAreaView>
  );
}

export function parseBatsmanPickerRole(value: string | undefined): BatsmanPickerRoleValue {
  if (value === BatsmanPickerRole.NonStriker) return BatsmanPickerRole.NonStriker;
  if (value === BatsmanPickerRole.Incoming) return BatsmanPickerRole.Incoming;
  return BatsmanPickerRole.Striker;
}
