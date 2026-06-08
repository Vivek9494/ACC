import type { Delivery } from '@prisma/client';

import type { ScoringEvent } from './engine';

/**
 * Collapses a persisted {@link Delivery}'s user/external participant columns
 * (ACC opponents are external — §9.5) into the opaque participant ids the pure
 * scoring engine folds over. Shared by the scoring writer and the read-model
 * builders so the mapping never diverges.
 */
export function toScoringEvent(d: Delivery): ScoringEvent {
  return {
    sequence: d.sequence,
    overNumber: d.overNumber,
    ballNumber: d.ballNumber,
    type: d.type,
    strikerId: d.strikerUserId ?? d.strikerExternalId ?? null,
    nonStrikerId: d.nonStrikerUserId ?? d.nonStrikerExternalId ?? null,
    bowlerId: d.bowlerUserId ?? d.bowlerExternalId ?? null,
    runsBat: d.runsBat,
    extraRuns: d.extraRuns,
    isBoundary: d.isBoundary,
    isFreeHit: d.isFreeHit,
    dismissalType: d.dismissalType,
    dismissedId: d.dismissedUserId ?? d.dismissedExternalId ?? null,
    fielderId: d.fielderUserId ?? d.fielderExternalId ?? null,
  };
}
