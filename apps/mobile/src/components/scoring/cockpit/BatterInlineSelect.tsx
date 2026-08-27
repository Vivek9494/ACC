import {
  BATSMAN_PICKER_STATUS_LABELS,
  BatsmanPickerRole,
  BatsmanPickerStatus,
  type BatsmanPickerPlayerRow,
  type BatsmanPickerRole as BatsmanPickerRoleValue,
} from '@acc/types';
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
import { ApiRequestError, getBatsmanPicker } from '../../../lib/api';

const STATUS_SORT: Record<BatsmanPickerStatus, number> = {
  [BatsmanPickerStatus.YetToBat]: 0,
  [BatsmanPickerStatus.AtCrease]: 1,
  [BatsmanPickerStatus.RetiredHurt]: 2,
  [BatsmanPickerStatus.Out]: 3,
};

export interface BatterInlineSelectProps {
  matchId: string;
  inningsId: string;
  role: 'striker' | 'nonStriker';
  /** Batter at the other crease — passed through to batsman-picker. */
  otherSlotUserId: string | null;
  displayName: string;
  /** Currently selected id for this slot (highlight). */
  selectedUserId: string | null;
  /** Same action the full-page picker uses after choose(). */
  onSelect: (userId: string) => void;
}

interface AnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function playerLabel(row: BatsmanPickerPlayerRow): string {
  return `${row.firstName} ${row.lastName}`.trim() || 'Player';
}

function sortEligible(players: BatsmanPickerPlayerRow[]): BatsmanPickerPlayerRow[] {
  return [...players].sort((a, b) => {
    const byStatus = STATUS_SORT[a.status] - STATUS_SORT[b.status];
    if (byStatus !== 0) return byStatus;
    return playerLabel(a).localeCompare(playerLabel(b));
  });
}

/**
 * Desktop Play Control batter field — inline dropdown over the batsman-picker API.
 * Mobile continues to use the full-page SelectBatsmanScreen.
 */
export function BatterInlineSelect({
  matchId,
  inningsId,
  role,
  otherSlotUserId,
  displayName,
  selectedUserId,
  onSelect,
}: BatterInlineSelectProps): React.ReactElement {
  const fieldRef = useRef<RNView>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  const [players, setPlayers] = useState<BatsmanPickerPlayerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickerRole: BatsmanPickerRoleValue =
    role === 'striker' ? BatsmanPickerRole.Striker : BatsmanPickerRole.NonStriker;

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const response = await getBatsmanPicker(matchId, inningsId, {
        role: pickerRole,
        otherSlotUserId,
      });
      setPlayers(sortEligible(response.players));
    } catch (err) {
      setPlayers([]);
      setError(err instanceof ApiRequestError ? err.message : 'Could not load batters.');
    } finally {
      setLoading(false);
    }
  }, [inningsId, matchId, otherSlotUserId, pickerRole]);

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

  function choose(row: BatsmanPickerPlayerRow): void {
    if (!row.selectable) return;
    closeDropdown();
    if (row.userId === selectedUserId) return;
    onSelect(row.userId);
  }

  const menuWidth = Math.max(anchor?.width ?? 200, 220);
  const menuTop = (anchor?.y ?? 0) + (anchor?.height ?? 0) + 2;
  const menuLeft = anchor?.x ?? 0;

  return (
    <View ref={fieldRef} className="min-w-0 flex-1" collapsable={false}>
      <Pressable
        onPress={openDropdown}
        accessibilityRole="button"
        accessibilityLabel={role === 'striker' ? 'Select striker' : 'Select non-striker'}
        className="min-h-[28px] min-w-0 flex-1 flex-row items-center justify-between gap-1 rounded border border-outline-variant bg-surface-container-lowest px-2 active:opacity-80"
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
                      No batters available.
                    </Text>
                  ) : (
                    players.map((row) => {
                      const disabled = !row.selectable;
                      const active = row.userId === selectedUserId;
                      const status =
                        row.status === BatsmanPickerStatus.Out && row.dismissalText
                          ? row.dismissalText
                          : BATSMAN_PICKER_STATUS_LABELS[row.status];
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
                            {status}
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
