import { DeliveryType, type TimelineEntry } from './scoring';

/** Normalized coordinate range for wagon-wheel shot placement. */
export const WAGON_WHEEL_COORD_MIN = -1;
export const WAGON_WHEEL_COORD_MAX = 1;

/**
 * Striker-end pitch centre in normalized field coordinates.
 * Y increases toward the bowler end; all shot lines originate here.
 */
export const WAGON_WHEEL_STRIKER_ORIGIN = { x: 0, y: -0.14 } as const;

/** 30-yard circle radius as a fraction of the boundary radius (≈1). */
export const WAGON_WHEEL_INNER_RING_RADIUS = 0.46;

export type WagonWheelFilter = 'team' | 'batter' | 'fours' | 'sixes' | 'boundaries';

export function isWagonWheelCoordInRange(value: number): boolean {
  return value >= WAGON_WHEEL_COORD_MIN && value <= WAGON_WHEEL_COORD_MAX;
}

/** True when a value is a finite normalized wagon-wheel coordinate. */
export function isValidWagonWheelCoord(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && isWagonWheelCoordInRange(value);
}

export function timelineEntryHasShotPlacement(
  entry: Pick<TimelineEntry, 'shotX' | 'shotY'>,
): boolean {
  return isValidWagonWheelCoord(entry.shotX) && isValidWagonWheelCoord(entry.shotY);
}

/** Whether the scorer may place a wagon-wheel point on this delivery. */
export function timelineEntryAcceptsShotPlacement(entry: TimelineEntry): boolean {
  const runsBat = entry.runsBat ?? 0;
  if (entry.deliveryType === DeliveryType.Legal && runsBat > 0) {
    return true;
  }
  if (entry.deliveryType === DeliveryType.NoBall && runsBat > 0) {
    return true;
  }
  if (entry.deliveryType != null) {
    return false;
  }
  if (entry.isWicket && runsBat <= 0) {
    return false;
  }
  if (entry.code === '1' || entry.code === '2' || entry.code === '3' || entry.code === '4' || entry.code === '6') {
    return true;
  }
  if (entry.code.startsWith('Nb') && runsBat > 0) {
    return true;
  }
  return false;
}

/** Off-bat runs for wagon-wheel line colouring (derived, never stored as a region). */
export function wagonWheelRunsFromEntry(entry: TimelineEntry): number {
  if (entry.runsBat != null && entry.runsBat > 0) {
    return entry.runsBat;
  }
  if (entry.code === '4') return 4;
  if (entry.code === '6') return 6;
  const parsed = Number.parseInt(entry.code, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function filterTimelineForWagonWheel(
  timeline: readonly TimelineEntry[],
  filter: WagonWheelFilter,
  batterId?: string | null,
): TimelineEntry[] {
  return timeline.filter((entry) => {
    if (!timelineEntryHasShotPlacement(entry)) {
      return false;
    }
    if (filter === 'team') {
      return true;
    }
    if (filter === 'batter') {
      return batterId != null && entry.strikerId === batterId;
    }
    const runs = wagonWheelRunsFromEntry(entry);
    if (filter === 'fours') {
      return runs === 4;
    }
    if (filter === 'sixes') {
      return runs === 6;
    }
    if (filter === 'boundaries') {
      return runs === 4 || runs === 6;
    }
    return true;
  });
}

/** Line colour by off-bat runs — 1–3 / 4 / 6. */
export function wagonWheelLineColor(runs: number): string {
  if (runs === 4) {
    return '#b45309';
  }
  if (runs === 6) {
    return '#ea580c';
  }
  return '#78716c';
}

/** Map a click inside the ground circle to normalized field coordinates. */
export function clampWagonWheelPoint(x: number, y: number): { x: number; y: number } {
  const radius = Math.hypot(x, y);
  if (radius <= WAGON_WHEEL_COORD_MAX) {
    return { x, y };
  }
  const scale = WAGON_WHEEL_COORD_MAX / radius;
  return { x: x * scale, y: y * scale };
}

/** SVG viewBox used by the wagon-wheel ground (same space as shotX/shotY). */
export const WAGON_WHEEL_VIEWBOX = {
  minX: -1.08,
  minY: -1.08,
  width: 2.16,
  height: 2.16,
} as const;

/**
 * Map a point inside the rendered SVG element to viewBox user space, then clamp
 * to the field circle. Uses the element's bounding rect + viewBox (padding/scroll
 * safe when clientX/Y are viewport coordinates).
 */
export function wagonWheelPointFromClientRect(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): { x: number; y: number } | null {
  if (
    rect.width <= 0 ||
    rect.height <= 0 ||
    !Number.isFinite(clientX) ||
    !Number.isFinite(clientY) ||
    !Number.isFinite(rect.left) ||
    !Number.isFinite(rect.top)
  ) {
    return null;
  }
  const x =
    WAGON_WHEEL_VIEWBOX.minX + ((clientX - rect.left) / rect.width) * WAGON_WHEEL_VIEWBOX.width;
  const y =
    WAGON_WHEEL_VIEWBOX.minY + ((clientY - rect.top) / rect.height) * WAGON_WHEEL_VIEWBOX.height;
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  return clampWagonWheelPoint(x, y);
}

/** Convert a press position inside the square ground view to normalized coords. */
export function wagonWheelPointFromViewCoords(
  locationX: number,
  locationY: number,
  width: number,
  height: number,
): { x: number; y: number } | null {
  return wagonWheelPointFromClientRect(locationX, locationY, {
    left: 0,
    top: 0,
    width,
    height,
  });
}

/** Resolve the delivery row id when the timeline only has sequence (fold-only rows). */
export function wagonWheelPlacementTarget(
  timeline: readonly TimelineEntry[],
): TimelineEntry | null {
  for (let index = timeline.length - 1; index >= 0; index -= 1) {
    const entry = timeline[index];
    if (entry && timelineEntryAcceptsShotPlacement(entry)) {
      return entry;
    }
  }
  return null;
}

export function wagonWheelPlacementDeliveryRef(entry: TimelineEntry): {
  deliveryId?: string;
  sequence: number;
} {
  return {
    sequence: entry.sequence,
    ...(entry.deliveryId ? { deliveryId: entry.deliveryId } : {}),
  };
}
