import type { TimelineEntry } from '@acc/types';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  View,
  type View as RNView,
} from 'react-native';

import { Text } from '../../ui/Text';
import { colors } from '../../../theme/colors';

interface AnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OverBallControlProps {
  /** 0..current over index (matches innings.oversText whole-over). */
  overOptions: readonly number[];
  ballOptions: readonly TimelineEntry[];
  selectedOver: number;
  selectedBall: number;
  onSelectOver: (over: number) => void;
  onSelectBall: (ballNumber: number) => void;
}

function InlineSelectChip({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Select ${label}`}
      className="min-h-[28px] min-w-[72px] flex-row items-center justify-between gap-1 rounded border border-outline-variant bg-surface-container-lowest px-2 active:opacity-80"
    >
      <Text className="font-sans text-[10px] text-on-surface-variant">{label}</Text>
      <View className="flex-row items-center gap-0.5">
        <Text className="font-sans-semibold text-[12px] text-on-surface">{value}</Text>
        <Ionicons name="chevron-down" size={11} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}

function DropdownModal({
  visible,
  anchor,
  onClose,
  children,
}: {
  visible: boolean;
  anchor: AnchorRect | null;
  onClose: () => void;
  children: React.ReactNode;
}): React.ReactElement {
  const menuTop = (anchor?.y ?? 0) + (anchor?.height ?? 0) + 2;
  const menuLeft = anchor?.x ?? 0;
  const menuWidth = Math.max(anchor?.width ?? 120, 160);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1">
        <Pressable className="absolute inset-0" onPress={onClose} accessibilityLabel="Close" />
        {anchor ? (
          <View
            className="absolute overflow-hidden rounded-control border border-outline-variant bg-surface"
            style={{
              top: menuTop,
              left: menuLeft,
              width: menuWidth,
              maxHeight: 240,
              shadowColor: '#000',
              shadowOpacity: 0.12,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
              elevation: 6,
            }}
          >
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 240 }}>
              {children}
            </ScrollView>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function DropdownRow({
  label,
  subtitle,
  active,
  onPress,
}: {
  label: string;
  subtitle?: string;
  active: boolean;
  onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      className={`border-b border-outline-variant px-2.5 py-2 ${
        active ? 'bg-primary-50' : 'active:bg-surface-container-low'
      }`}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text
        className={`font-sans-semibold text-[12px] ${active ? 'text-primary' : 'text-on-surface'}`}
        numberOfLines={1}
      >
        {label}
      </Text>
      {subtitle ? (
        <Text className="mt-0.5 font-sans text-[10px] text-on-surface-variant" numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** Desktop Play Control — over/ball position pickers for edit-a-past-ball. */
export function OverBallControl({
  overOptions,
  ballOptions,
  selectedOver,
  selectedBall,
  onSelectOver,
  onSelectBall,
}: OverBallControlProps): React.ReactElement {
  const overRef = useRef<RNView>(null);
  const ballRef = useRef<RNView>(null);
  const [overOpen, setOverOpen] = useState(false);
  const [ballOpen, setBallOpen] = useState(false);
  const [overAnchor, setOverAnchor] = useState<AnchorRect | null>(null);
  const [ballAnchor, setBallAnchor] = useState<AnchorRect | null>(null);

  const openOver = useCallback((): void => {
    overRef.current?.measureInWindow((x, y, width, height) => {
      setOverAnchor({ x, y, width, height });
      setOverOpen(true);
    });
  }, []);

  const openBall = useCallback((): void => {
    ballRef.current?.measureInWindow((x, y, width, height) => {
      setBallAnchor({ x, y, width, height });
      setBallOpen(true);
    });
  }, []);

  const ballLabels = useMemo(
    () =>
      ballOptions.map((entry) => ({
        ballNumber: entry.ballNumber ?? 0,
        label: `${entry.ballNumber} — ${entry.code}`,
        subtitle: entry.description,
        entry,
      })),
    [ballOptions],
  );

  return (
    <>
      <View ref={overRef} collapsable={false}>
        <InlineSelectChip label="Over" value={String(selectedOver)} onPress={openOver} />
      </View>
      <View ref={ballRef} collapsable={false}>
        <InlineSelectChip label="Ball" value={String(selectedBall)} onPress={openBall} />
      </View>

      <DropdownModal visible={overOpen} anchor={overAnchor} onClose={() => setOverOpen(false)}>
        {overOptions.map((over) => (
          <DropdownRow
            key={over}
            label={`Over ${over}`}
            active={over === selectedOver}
            onPress={() => {
              setOverOpen(false);
              onSelectOver(over);
            }}
          />
        ))}
      </DropdownModal>

      <DropdownModal visible={ballOpen} anchor={ballAnchor} onClose={() => setBallOpen(false)}>
        {ballLabels.length === 0 ? (
          <Text className="px-3 py-4 text-center font-sans text-[12px] text-on-surface-variant">
            No deliveries in this over yet.
          </Text>
        ) : (
          ballLabels.map((row) => (
            <DropdownRow
              key={`${row.ballNumber}-${row.entry.sequence}`}
              label={row.label}
              subtitle={row.subtitle}
              active={row.ballNumber === selectedBall}
              onPress={() => {
                setBallOpen(false);
                onSelectBall(row.ballNumber);
              }}
            />
          ))
        )}
      </DropdownModal>
    </>
  );
}
