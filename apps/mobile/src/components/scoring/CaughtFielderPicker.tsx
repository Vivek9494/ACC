import type { FielderPickerPlayerRow, FielderPickerResponse } from '@acc/types';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from 'react-native';

import { AddExternalBowlerDialog } from './AddExternalBowlerDialog';
import { Button } from '../ui/Button';
import { Text } from '../ui/Text';
import { FIELD_ORANGE, INPUT_SHADOW_STYLE } from '../ui/fieldStyles';
import { ApiRequestError, getFielderPicker } from '../../lib/api';

export interface CaughtFielderPickerProps {
  visible: boolean;
  matchId: string;
  inningsId: string;
  selectedFielderId?: string | null;
  onBack: () => void;
  onCancel: () => void;
  onConfirm: (fielderId: string) => void;
}

function playerLabel(row: FielderPickerPlayerRow): string {
  return `${row.firstName} ${row.lastName}`.trim() || 'Player';
}

function rowSubtitle(row: FielderPickerPlayerRow): string {
  if (row.isCurrentBowler) return 'Bowler';
  return '—';
}

/**
 * Bowling-side fielder picker for caught dismissals (§12.1).
 * Presentation matches {@link ConfirmNextBowlerDialog}: centered modal, bordered list, Cancel | OK.
 */
export function CaughtFielderPicker({
  visible,
  matchId,
  inningsId,
  selectedFielderId = null,
  onBack,
  onCancel,
  onConfirm,
}: CaughtFielderPickerProps): React.ReactElement {
  const [data, setData] = useState<FielderPickerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(selectedFielderId);
  const [showAddExternal, setShowAddExternal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getFielderPicker(matchId, inningsId);
      setData(response);
    } catch (err) {
      setData(null);
      setError(err instanceof ApiRequestError ? err.message : 'Could not load fielders.');
    } finally {
      setLoading(false);
    }
  }, [inningsId, matchId]);

  useEffect(() => {
    if (visible) {
      setSelectedId(selectedFielderId);
      void load();
    } else {
      setData(null);
      setSelectedId(null);
      setError(null);
      setShowAddExternal(false);
    }
  }, [visible, selectedFielderId, load]);

  const isExternalSide = data?.bowlingSideIsExternal === true;
  const showAddFielderByName =
    isExternalSide && data?.externalPlayingXiConfirmed !== true;

  const players = data?.players ?? [];

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
        <Pressable className="flex-1 items-center justify-center bg-black/40 px-4" onPress={onCancel}>
          <Pressable
            className="w-full max-w-md overflow-hidden rounded-control bg-surface"
            style={INPUT_SHADOW_STYLE}
            onPress={(event) => event.stopPropagation()}
          >
            <View className="border-b border-outline-variant px-4 py-3">
              <Text className="font-sans-bold text-lg text-on-surface">Who took the catch?</Text>
            </View>

            <View className="gap-3 p-4">
              <View className="max-h-64 overflow-hidden rounded-control border border-outline-variant">
                {loading ? (
                  <View className="items-center py-8">
                    <ActivityIndicator color={FIELD_ORANGE} />
                  </View>
                ) : error ? (
                  <View className="gap-2 px-3 py-3">
                    <Text className="font-sans text-[12px] text-primary">{error}</Text>
                    <Pressable onPress={() => void load()} accessibilityRole="button">
                      <Text className="font-sans-semibold text-[12px] text-primary">Retry</Text>
                    </Pressable>
                  </View>
                ) : (
                  <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 256 }}>
                    {players.length === 0 ? (
                      <Text className="px-3 py-4 text-center font-sans text-[12px] text-on-surface-variant">
                        {isExternalSide
                          ? 'No fielders added yet. Add the catcher by name below.'
                          : 'No bowling-side players available.'}
                      </Text>
                    ) : (
                      players.map((row) => {
                        const active = selectedId === row.userId;
                        return (
                          <Pressable
                            key={row.userId}
                            onPress={() => setSelectedId(row.userId)}
                            className={`border-b border-outline-variant px-3 py-2.5 ${
                              active ? 'bg-primary-50' : 'active:bg-surface-container-low'
                            }`}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                          >
                            <Text
                              className={`font-sans-semibold text-[13px] ${
                                active ? 'text-primary' : 'text-on-surface'
                              }`}
                              numberOfLines={1}
                            >
                              {playerLabel(row)}
                            </Text>
                            <Text
                              className="mt-0.5 font-sans text-[11px] text-on-surface-variant"
                              numberOfLines={1}
                            >
                              {rowSubtitle(row)}
                            </Text>
                          </Pressable>
                        );
                      })
                    )}
                  </ScrollView>
                )}
              </View>

              {showAddFielderByName ? (
                <Button
                  variant="outline"
                  label="Add Fielder by Name"
                  onPress={() => setShowAddExternal(true)}
                  className="h-11"
                />
              ) : null}

              <View className="flex-row gap-2">
                <Button
                  label="Cancel"
                  variant="outline"
                  onPress={onBack}
                  className="h-11 flex-1"
                />
                <Button
                  label="OK"
                  onPress={() => {
                    if (selectedId) onConfirm(selectedId);
                  }}
                  disabled={!selectedId}
                  className="h-11 flex-1"
                />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

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
  );
}
