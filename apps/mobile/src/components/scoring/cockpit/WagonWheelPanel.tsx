import {
  timelineEntryHasShotPlacement,
  wagonWheelPlacementDeliveryRef,
  wagonWheelPlacementTarget,
  wagonWheelRunsFromEntry,
  type InningsScorecard,
  type TimelineEntry,
} from '@acc/types';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '../../ui/Text';
import { CockpitPanel } from './CockpitPanel';
import { WagonWheelGround } from './WagonWheelGround';

export function WagonWheelPanel({
  innings,
  nameOf,
  working,
  onSetShotPlacement,
}: {
  innings: InningsScorecard;
  nameOf: (id: string | null) => string;
  working?: boolean;
  onSetShotPlacement: (
    target: { deliveryId?: string; sequence: number },
    shotX: number | null,
    shotY: number | null,
  ) => void;
}): React.ReactElement {
  const [pendingShot, setPendingShot] = useState<{
    sequence: number;
    shotX: number;
    shotY: number;
  } | null>(null);
  /** Immediate UI lock so rapid clicks cannot fire multiple PATCH saves. */
  const [saveInFlight, setSaveInFlight] = useState(false);
  const saveInFlightRef = useRef(false);

  const placementTarget = useMemo(
    () => wagonWheelPlacementTarget(innings.timeline),
    [innings.timeline],
  );

  // New ball → drop optimistic shot for the previous sequence (display-only; DB untouched).
  useEffect(() => {
    if (!pendingShot) {
      return;
    }
    if (!placementTarget || placementTarget.sequence !== pendingShot.sequence) {
      setPendingShot(null);
    }
  }, [placementTarget, pendingShot]);

  useEffect(() => {
    if (!working) {
      saveInFlightRef.current = false;
      setSaveInFlight(false);
    }
  }, [working]);

  useEffect(() => {
    if (!pendingShot || !placementTarget) {
      return;
    }
    if (placementTarget.sequence !== pendingShot.sequence) {
      return;
    }
    if (
      timelineEntryHasShotPlacement(placementTarget) &&
      Math.abs((placementTarget.shotX ?? 0) - pendingShot.shotX) < 0.001 &&
      Math.abs((placementTarget.shotY ?? 0) - pendingShot.shotY) < 0.001
    ) {
      setPendingShot(null);
      saveInFlightRef.current = false;
      setSaveInFlight(false);
    }
  }, [innings.timeline, pendingShot, placementTarget]);

  const displayTarget = useMemo((): TimelineEntry | null => {
    if (!placementTarget) {
      return null;
    }
    if (pendingShot && pendingShot.sequence === placementTarget.sequence) {
      return {
        ...placementTarget,
        shotX: pendingShot.shotX,
        shotY: pendingShot.shotY,
      };
    }
    return placementTarget;
  }, [pendingShot, placementTarget]);

  /** Live capture: only the current ball (blank until placed). */
  const visibleEntries = useMemo(() => {
    if (displayTarget && timelineEntryHasShotPlacement(displayTarget)) {
      return [displayTarget];
    }
    return [];
  }, [displayTarget]);

  const canPlace = placementTarget != null && !working && !saveInFlight;
  const targetHasShot =
    displayTarget != null && timelineEntryHasShotPlacement(displayTarget);

  const targetRuns = placementTarget ? wagonWheelRunsFromEntry(placementTarget) : 0;
  const statusLine = placementTarget
    ? `Click the ground to place ${nameOf(placementTarget.strikerId)}'s ${targetRuns} run${
        targetRuns === 1 ? '' : 's'
      } (${placementTarget.label || 'ball'})`
    : 'Score an off-bat run to place a shot';

  const commitPlacement = (shotX: number | null, shotY: number | null): void => {
    if (!placementTarget || working || saveInFlightRef.current) {
      return;
    }
    const target = wagonWheelPlacementDeliveryRef(placementTarget);
    if (shotX != null && shotY != null) {
      if (!Number.isFinite(shotX) || !Number.isFinite(shotY)) {
        return;
      }
      setPendingShot({ sequence: placementTarget.sequence, shotX, shotY });
    } else {
      setPendingShot(null);
    }
    saveInFlightRef.current = true;
    setSaveInFlight(true);
    onSetShotPlacement(target, shotX, shotY);
  };

  return (
    <CockpitPanel title="Wagon Wheel" live bodyNoPad>
      <View className="min-h-0 flex-1">
        <View className="flex-row items-center justify-between gap-2 border-b border-outline-variant px-2 py-1.5">
          <Text
            className="min-w-0 flex-1 font-sans text-[10px] text-on-surface-variant"
            numberOfLines={2}
          >
            {statusLine}
          </Text>
          {targetHasShot && placementTarget ? (
            <Pressable
              onPress={() => commitPlacement(null, null)}
              disabled={working || saveInFlight}
              className="rounded border border-outline-variant bg-surface px-1.5 py-0.5"
              accessibilityRole="button"
              accessibilityLabel="Clear shot placement for this ball"
            >
              <Text className="font-sans-semibold text-[9px] text-on-surface-variant">Clear</Text>
            </Pressable>
          ) : null}
        </View>

        <View className="min-h-0 flex-1 px-1 pb-1 pt-0.5">
          <WagonWheelGround
            entries={visibleEntries}
            activeEntry={displayTarget}
            placementEnabled={canPlace}
            onPlace={(x, y) => commitPlacement(x, y)}
          />
        </View>
      </View>
    </CockpitPanel>
  );
}
