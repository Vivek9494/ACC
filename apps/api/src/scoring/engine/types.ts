import type { DeliveryType, DismissalType, InningsType } from '@acc/types';

/**
 * A single immutable scoring event, decoupled from Prisma so the engine stays a
 * pure function of its inputs (spec §12). Participant ids are opaque strings
 * (system user id or an external-player id) — the engine never interprets them.
 */
export interface ScoringEvent {
  sequence: number;
  overNumber: number | null;
  ballNumber: number | null;
  type: DeliveryType;
  strikerId: string | null;
  nonStrikerId: string | null;
  bowlerId: string | null;
  /** Runs off the bat, INCLUDING overthrows on the same delivery (§12.1). */
  runsBat: number;
  /** Extras credited to the batting team (wide/no-ball penalty, byes, penalty). */
  extraRuns: number;
  /** Completed byes on a no-ball delivery (§12.1). */
  noBallByeRuns: number;
  /** Completed leg-byes on a no-ball delivery (§12.1). */
  noBallLegByeRuns: number;
  /** Penalty-runs beneficiary team id (opaque); null = batting side of recording innings. */
  penaltyBeneficiaryTeamId: string | null;
  /** Monotonic sort key for cross-innings penalty merge (delivery createdAt ms). */
  eventSortMs: number;
  /** 4/6 off the bat — boundaries never rotate strike (§32). */
  isBoundary: boolean;
  isFreeHit: boolean;
  dismissalType: DismissalType | null;
  dismissedId: string | null;
  fielderId: string | null;
  fielder2Id: string | null;
}

/** Static facts about an innings the fold needs (allotment, chase target). */
export interface InningsContext {
  inningsId?: string | null;
  sequence?: number;
  inningsType?: InningsType;
  battingTeamId?: string | null;
  bowlingTeamId?: string | null;
  oversAllotted?: number | null;
  /** The chase target in effect (DLS overrides original — §12.1). */
  target?: number | null;
  /** Scorer selections persisted on the innings row until baked into a delivery. */
  selectedStrikerId?: string | null;
  selectedNonStrikerId?: string | null;
  selectedBowlerId?: string | null;
}
