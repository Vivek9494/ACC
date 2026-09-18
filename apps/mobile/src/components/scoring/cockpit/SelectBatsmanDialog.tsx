import {
  BATSMAN_PICKER_STATUS_LABELS,
  BatsmanPickerStatus,
  type BatsmanPickerPlayerRow,
  type BatsmanPickerRole as BatsmanPickerRoleValue,
} from '@acc/types';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from 'react-native';

import { AddExternalBatsmanDialog } from '../AddExternalBatsmanDialog';
import { Button } from '../../ui/Button';
import { Text } from '../../ui/Text';
import { FIELD_ORANGE, INPUT_SHADOW_STYLE } from '../../ui/fieldStyles';
import { ApiRequestError, getBatsmanPicker } from '../../../lib/api';
import type { IncomingCreaseSlot } from '../../../lib/scoring-pick-session';

export interface SelectBatsmanDialogProps {
  visible: boolean;
  matchId: string;
  inningsId: string;
  role: BatsmanPickerRoleValue;
  otherSlotUserId?: string | null;
  incomingSlot?: IncomingCreaseSlot | null;
  onCancel: () => void;
  onConfirm: (result: {
    userId: string;
    role: BatsmanPickerRoleValue;
    incomingSlot?: IncomingCreaseSlot;
  }) => void;
  confirming?: boolean;
}

function playerLabel(row: BatsmanPickerPlayerRow): string {
  return `${row.firstName} ${row.lastName}`.trim() || 'Player';
}

function rowSubtitle(row: BatsmanPickerPlayerRow): string {
  if (row.status === BatsmanPickerStatus.Out && row.dismissalText) {
    return row.dismissalText;
  }
  if (row.status === BatsmanPickerStatus.RetiredHurt && row.dismissalText) {
    return row.dismissalText;
  }
  if (row.status === BatsmanPickerStatus.AtCrease && row.runs !== null && row.balls !== null) {
    return `${row.runs} (${row.balls})`;
  }
  return BATSMAN_PICKER_STATUS_LABELS[row.status];
}

/**
 * Desktop/Electron cockpit — Select Batsman as a centered modal (same shell as
 * {@link ConfirmNextBowlerDialog}). Mobile keeps the full-page SelectBatsmanScreen.
 */
export function SelectBatsmanDialog({
  visible,
  matchId,
  inningsId,
  role,
  otherSlotUserId = null,
  incomingSlot = null,
  onCancel,
  onConfirm,
  confirming = false,
}: SelectBatsmanDialogProps): React.ReactElement {
  const [players, setPlayers] = useState<BatsmanPickerPlayerRow[]>([]);
  const [battingTeamName, setBattingTeamName] = useState('');
  const [isExternalSide, setIsExternalSide] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAddExternal, setShowAddExternal] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    if (!matchId || !inningsId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await getBatsmanPicker(matchId, inningsId, {
        role,
        otherSlotUserId,
      });
      setBattingTeamName(response.battingTeamName);
      setIsExternalSide(response.battingSideIsExternal === true);
      const sorted = [...response.players].sort((a, b) => {
        if (a.selectable !== b.selectable) return a.selectable ? -1 : 1;
        return playerLabel(a).localeCompare(playerLabel(b));
      });
      setPlayers(sorted);
    } catch (err) {
      setPlayers([]);
      setError(err instanceof ApiRequestError ? err.message : 'Could not load batters.');
    } finally {
      setLoading(false);
    }
  }, [inningsId, matchId, otherSlotUserId, role]);

  useEffect(() => {
    if (!visible) {
      setSelectedId(null);
      setError(null);
      setShowAddExternal(false);
      return;
    }
    void load();
  }, [visible, load]);

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
              <Text className="font-sans-bold text-lg text-on-surface">Select Batsman</Text>
              {battingTeamName ? (
                <Text className="mt-1 font-sans text-sm text-on-surface-variant">
                  {battingTeamName}
                </Text>
              ) : null}
            </View>
            <View className="gap-3 p-4">
              <View className="max-h-72 overflow-hidden rounded-control border border-outline-variant">
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
                  <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 288 }}>
                    {players.length === 0 ? (
                      <Text className="px-3 py-4 text-center font-sans text-[12px] text-on-surface-variant">
                        {isExternalSide
                          ? 'No batters added yet. Add a batsman by name below.'
                          : 'No batters available.'}
                      </Text>
                    ) : (
                      players.map((row) => {
                        const disabled = !row.selectable;
                        const active = selectedId === row.userId;
                        return (
                          <Pressable
                            key={row.userId}
                            disabled={disabled || confirming}
                            onPress={() => setSelectedId(row.userId)}
                            className={`border-b border-outline-variant px-3 py-2.5 ${
                              active ? 'bg-primary-50' : ''
                            } ${disabled ? 'opacity-45' : 'active:bg-surface-container-low'}`}
                            accessibilityRole="button"
                            accessibilityState={{ disabled, selected: active }}
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

              {isExternalSide ? (
                <Button
                  variant="outline"
                  label="Add New Batsman"
                  onPress={() => setShowAddExternal(true)}
                  disabled={confirming}
                  className="h-11"
                />
              ) : null}

              <View className="flex-row gap-2">
                <Button
                  label="Cancel"
                  variant="outline"
                  onPress={onCancel}
                  disabled={confirming}
                  className="h-11 flex-1"
                />
                <Button
                  label={confirming ? 'Saving…' : 'OK'}
                  onPress={() => {
                    if (!selectedId) return;
                    onConfirm({
                      userId: selectedId,
                      role,
                      ...(incomingSlot ? { incomingSlot } : {}),
                    });
                  }}
                  disabled={!selectedId || confirming}
                  className="h-11 flex-1"
                />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

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
    </>
  );
}
