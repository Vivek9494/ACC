import type { BowlerPickerPlayerRow } from '@acc/types';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from 'react-native';

import { Button } from '../../ui/Button';
import { Text } from '../../ui/Text';
import { FIELD_ORANGE, INPUT_SHADOW_STYLE } from '../../ui/fieldStyles';
import { ApiRequestError, getBowlerPicker } from '../../../lib/api';

export interface EndOverConfirmDialogProps {
  visible: boolean;
  onNo: () => void;
  onYes: () => void;
}

/** Dialog 1 — confirm ending the over before any over-transition is committed. */
export function EndOverConfirmDialog({
  visible,
  onNo,
  onYes,
}: EndOverConfirmDialogProps): React.ReactElement {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onNo}>
      <Pressable className="flex-1 items-center justify-center bg-black/40 px-4" onPress={onNo}>
        <Pressable
          className="w-full max-w-sm overflow-hidden rounded-control bg-surface"
          style={INPUT_SHADOW_STYLE}
          onPress={(event) => event.stopPropagation()}
        >
          <View className="border-b border-outline-variant px-4 py-3">
            <Text className="font-sans-bold text-lg text-on-surface">
              Are you sure you want to end this over?
            </Text>
          </View>
          <View className="gap-3 p-4">
            <View className="flex-row gap-2">
              <Button label="No" variant="outline" onPress={onNo} className="h-11 flex-1" />
              <Button label="Yes" onPress={onYes} className="h-11 flex-1" />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function playerLabel(row: BowlerPickerPlayerRow): string {
  return `${row.firstName} ${row.lastName}`.trim() || 'Player';
}

function rowSubtitle(row: BowlerPickerPlayerRow, forcedDisabled: boolean): string {
  if (forcedDisabled) return 'Bowled previous over';
  if (row.ineligibilityHint) return row.ineligibilityHint;
  const parts: string[] = [];
  if (row.bowlingTypeLabel) parts.push(row.bowlingTypeLabel);
  if (row.figuresOmRw) parts.push(row.figuresOmRw);
  return parts.join(' · ') || '—';
}

export interface ConfirmNextBowlerDialogProps {
  visible: boolean;
  matchId: string;
  inningsId: string;
  /** Over number about to start (N). */
  upcomingOver: number;
  /**
   * Bowler who just finished (or is finishing) the previous over — always disabled
   * for consecutive-over rule even if the 6th ball is not yet persisted.
   */
  previousOverBowlerId: string | null;
  onCancel: () => void;
  onConfirm: (bowlerId: string) => void;
  confirming?: boolean;
}

/** Dialog 2 — pick the bowler for the upcoming over, then commit. */
export function ConfirmNextBowlerDialog({
  visible,
  matchId,
  inningsId,
  upcomingOver,
  previousOverBowlerId,
  onCancel,
  onConfirm,
  confirming = false,
}: ConfirmNextBowlerDialogProps): React.ReactElement {
  const [players, setPlayers] = useState<BowlerPickerPlayerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (!matchId || !inningsId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await getBowlerPicker(matchId, inningsId);
      const sorted = [...response.players].sort((a, b) => {
        const aDisabled = !a.selectable || a.userId === previousOverBowlerId;
        const bDisabled = !b.selectable || b.userId === previousOverBowlerId;
        if (aDisabled !== bDisabled) return aDisabled ? 1 : -1;
        return playerLabel(a).localeCompare(playerLabel(b));
      });
      setPlayers(sorted);
    } catch (err) {
      setPlayers([]);
      setError(err instanceof ApiRequestError ? err.message : 'Could not load bowlers.');
    } finally {
      setLoading(false);
    }
  }, [inningsId, matchId, previousOverBowlerId]);

  useEffect(() => {
    if (!visible) {
      setSelectedId(null);
      setError(null);
      return;
    }
    void load();
  }, [visible, load]);

  function isDisabled(row: BowlerPickerPlayerRow): boolean {
    return !row.selectable || row.userId === previousOverBowlerId;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable className="flex-1 items-center justify-center bg-black/40 px-4" onPress={onCancel}>
        <Pressable
          className="w-full max-w-md overflow-hidden rounded-control bg-surface"
          style={INPUT_SHADOW_STYLE}
          onPress={(event) => event.stopPropagation()}
        >
          <View className="border-b border-outline-variant px-4 py-3">
            <Text className="font-sans-bold text-lg text-on-surface">
              Please confirm the bowler for Over {upcomingOver}:
            </Text>
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
                      No bowlers available.
                    </Text>
                  ) : (
                    players.map((row) => {
                      const disabled = isDisabled(row);
                      const active = selectedId === row.userId;
                      const forcedPrev = row.userId === previousOverBowlerId;
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
                            {rowSubtitle(row, forcedPrev)}
                          </Text>
                        </Pressable>
                      );
                    })
                  )}
                </ScrollView>
              )}
            </View>

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
                  if (selectedId) onConfirm(selectedId);
                }}
                disabled={!selectedId || confirming}
                className="h-11 flex-1"
              />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Upcoming over number when ending the current over at `legalBalls` (before or at boundary). */
export function upcomingOverNumber(legalBalls: number): number {
  if (legalBalls > 0 && legalBalls % 6 === 0) {
    return legalBalls / 6 + 1;
  }
  return Math.floor(legalBalls / 6) + 2;
}
