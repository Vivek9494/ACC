import type { BowlerPickerPlayerRow } from '@acc/types';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  View,
  type View as RNView,
} from 'react-native';

import { Text } from '../../ui/Text';
import { FIELD_ORANGE } from '../../ui/fieldStyles';
import { colors } from '../../../theme/colors';
import { ApiRequestError, getBowlerPicker } from '../../../lib/api';

/** Play Control bowler field width — header spacer must match exactly. */
export const BOWLER_PLAY_CONTROL_DROPDOWN_W = 180;

export interface BowlerInlineSelectProps {
  matchId: string;
  inningsId: string;
  displayName: string;
  selectedUserId: string | null;
  /** Same action the full-page bowler picker uses after choose(). */
  onSelect: (userId: string) => void;
  width?: number;
}

interface AnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function playerLabel(row: BowlerPickerPlayerRow): string {
  return `${row.firstName} ${row.lastName}`.trim() || 'Player';
}

function sortBowlers(players: BowlerPickerPlayerRow[]): BowlerPickerPlayerRow[] {
  return [...players].sort((a, b) => {
    if (a.selectable !== b.selectable) return a.selectable ? -1 : 1;
    if (a.selected !== b.selected) return a.selected ? -1 : 1;
    return playerLabel(a).localeCompare(playerLabel(b));
  });
}

function rowSubtitle(row: BowlerPickerPlayerRow): string {
  if (row.ineligibilityHint) return row.ineligibilityHint;
  const parts: string[] = [];
  if (row.bowlingTypeLabel) parts.push(row.bowlingTypeLabel);
  if (row.figuresOmRw) parts.push(row.figuresOmRw);
  return parts.join(' · ') || '—';
}

/**
 * Desktop Play Control bowler field — inline dropdown over the bowler-picker API.
 * Mobile continues to use the full-page SelectBowlerScreen.
 */
export function BowlerInlineSelect({
  matchId,
  inningsId,
  displayName,
  selectedUserId,
  onSelect,
  width = BOWLER_PLAY_CONTROL_DROPDOWN_W,
}: BowlerInlineSelectProps): React.ReactElement {
  const fieldRef = useRef<RNView>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  const [players, setPlayers] = useState<BowlerPickerPlayerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const response = await getBowlerPicker(matchId, inningsId);
      setPlayers(sortBowlers(response.players));
    } catch (err) {
      setPlayers([]);
      setError(err instanceof ApiRequestError ? err.message : 'Could not load bowlers.');
    } finally {
      setLoading(false);
    }
  }, [inningsId, matchId]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  function openDropdown(): void {
    if (!inningsId) return;
    fieldRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setOpen(true);
    });
  }

  function closeDropdown(): void {
    setOpen(false);
    setAnchor(null);
  }

  function choose(row: BowlerPickerPlayerRow): void {
    if (!row.selectable) return;
    closeDropdown();
    if (row.userId === selectedUserId) return;
    onSelect(row.userId);
  }

  const menuWidth = Math.max(anchor?.width ?? 200, 240);
  const menuTop = (anchor?.y ?? 0) + (anchor?.height ?? 0) + 2;
  const menuLeft = anchor?.x ?? 0;

  return (
    <View ref={fieldRef} className="min-w-0 w-[148px] shrink-0" collapsable={false}>
      <Pressable
        onPress={openDropdown}
        accessibilityRole="button"
        accessibilityLabel="Select bowler"
        className="min-h-[28px] w-full min-w-0 flex-row items-center justify-between gap-1 rounded border border-outline-variant bg-surface-container-lowest px-2 active:opacity-80"
      >
        <Text
          className="min-w-0 flex-1 font-sans-medium text-[12px] text-on-surface"
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {displayName}
        </Text>
        <Ionicons name="chevron-down" size={12} color={colors.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={closeDropdown}>
        <View className="flex-1">
          <Pressable className="absolute inset-0" onPress={closeDropdown} accessibilityLabel="Close" />
          {anchor ? (
            <View
              className="absolute overflow-hidden rounded-control border border-outline-variant bg-surface"
              style={{
                top: menuTop,
                left: menuLeft,
                width: menuWidth,
                maxHeight: 280,
                shadowColor: '#000',
                shadowOpacity: 0.12,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 4 },
                elevation: 6,
              }}
            >
              {loading ? (
                <View className="items-center py-6">
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
                <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 280 }}>
                  {players.length === 0 ? (
                    <Text className="px-3 py-4 text-center font-sans text-[12px] text-on-surface-variant">
                      No bowlers available.
                    </Text>
                  ) : (
                    players.map((row) => {
                      const disabled = !row.selectable;
                      const active = row.userId === selectedUserId || row.selected;
                      return (
                        <Pressable
                          key={row.userId}
                          disabled={disabled}
                          onPress={() => choose(row)}
                          className={`border-b border-outline-variant px-2.5 py-2 ${
                            active ? 'bg-primary-50' : ''
                          } ${disabled ? 'opacity-45' : 'active:bg-surface-container-low'}`}
                          accessibilityRole="button"
                          accessibilityState={{ disabled, selected: active }}
                        >
                          <Text
                            className={`font-sans-semibold text-[12px] ${
                              active ? 'text-primary' : 'text-on-surface'
                            }`}
                            numberOfLines={1}
                          >
                            {playerLabel(row)}
                          </Text>
                          <Text
                            className="mt-0.5 font-sans text-[10px] text-on-surface-variant"
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
          ) : null}
        </View>
      </Modal>
    </View>
  );
}
