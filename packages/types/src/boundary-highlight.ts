/**
 * v0 boundary auto-highlight markers — mark-only (no clip / recording / ffmpeg).
 * Input for a future v1 worker that cuts [t−30s, t+5s] from a match recording.
 */

/** Boundary type stored on the delivery highlight marker. */
export type BoundaryHighlightRuns = 4 | 6;

/** Marker status — v0 is always MARKED; v1 may add CLIP_PENDING / CLIP_READY. */
export type BoundaryHighlightStatus = 'MARKED';

/**
 * Per-delivery highlight marker exposed on the scorecard timeline and match list.
 * Ball refs are denormalized for workers/editors that do not join Delivery rows.
 */
export interface DeliveryHighlightMarker {
  deliveryId: string;
  inningsId: string;
  sequence: number;
  /** Event time (ISO 8601 UTC) — score tap / Delivery.createdAt at mark time. */
  markedAt: string;
  overNumber: number | null;
  ballNumber: number | null;
  /** Position label, e.g. "12.3"; empty when over/ball unset. */
  ballLabel: string;
  strikerId: string | null;
  bowlerId: string | null;
  /** Runs off the bat on this delivery (may exceed 4/6 with overthrows). */
  runsBat: number;
  /** Boundary type for clipping: 4 or 6. */
  boundaryRuns: BoundaryHighlightRuns;
  status: BoundaryHighlightStatus;
}

/** Resolve 4 vs 6 for a boundary delivery; null when not a boundary. */
export function resolveBoundaryHighlightRuns(
  isBoundary: boolean,
  runsBat: number,
): BoundaryHighlightRuns | null {
  if (!isBoundary) {
    return null;
  }
  return runsBat >= 6 ? 6 : 4;
}

export function formatBoundaryBallLabel(
  overNumber: number | null | undefined,
  ballNumber: number | null | undefined,
): string {
  if (overNumber == null || ballNumber == null) {
    return '';
  }
  return `${overNumber}.${ballNumber}`;
}

/** Build a v0 marker payload from persisted delivery fields (or isBoundary fallback). */
export function buildDeliveryHighlightMarker(input: {
  deliveryId: string;
  inningsId: string;
  sequence: number;
  isBoundary: boolean;
  runsBat: number;
  createdAt: Date | string;
  highlightMarkedAt?: Date | string | null;
  highlightBoundaryRuns?: number | null;
  overNumber: number | null;
  ballNumber: number | null;
  strikerId: string | null;
  bowlerId: string | null;
}): DeliveryHighlightMarker | null {
  const boundaryRuns: BoundaryHighlightRuns | null =
    input.highlightBoundaryRuns === 4 || input.highlightBoundaryRuns === 6
      ? input.highlightBoundaryRuns
      : resolveBoundaryHighlightRuns(input.isBoundary, input.runsBat);
  if (boundaryRuns == null) {
    return null;
  }

  const markedSource = input.highlightMarkedAt ?? input.createdAt;
  const markedAt =
    markedSource instanceof Date
      ? markedSource.toISOString()
      : new Date(markedSource).toISOString();

  return {
    deliveryId: input.deliveryId,
    inningsId: input.inningsId,
    sequence: input.sequence,
    markedAt,
    overNumber: input.overNumber,
    ballNumber: input.ballNumber,
    ballLabel: formatBoundaryBallLabel(input.overNumber, input.ballNumber),
    strikerId: input.strikerId,
    bowlerId: input.bowlerId,
    runsBat: input.runsBat,
    boundaryRuns,
    status: 'MARKED',
  };
}
