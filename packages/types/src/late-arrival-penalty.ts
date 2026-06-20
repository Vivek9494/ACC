/** Late-arrival penalty lifecycle (§10 Phase 2). Mirrors Prisma enum. */
export const LateArrivalPenaltyState = {
  Owed: 'OWED',
  Assigned: 'ASSIGNED',
  Discharged: 'DISCHARGED',
  Cancelled: 'CANCELLED',
} as const;

export type LateArrivalPenaltyState =
  (typeof LateArrivalPenaltyState)[keyof typeof LateArrivalPenaltyState];

/** Active states — a player may have at most one of these at a time. */
export const ACTIVE_LATE_ARRIVAL_PENALTY_STATES: readonly LateArrivalPenaltyState[] = [
  LateArrivalPenaltyState.Owed,
  LateArrivalPenaltyState.Assigned,
];

/** Recorded on carry-forward transitions when a designated serve fails. */
export const LateArrivalFailedServeReason = {
  Late: 'LATE',
  NoShow: 'NO_SHOW',
} as const;

export type LateArrivalFailedServeReason =
  (typeof LateArrivalFailedServeReason)[keyof typeof LateArrivalFailedServeReason];

export type PlayerLateArrivalPenaltyStatus =
  | { status: 'NONE' }
  | {
      status: 'OWED';
      penaltyId: string;
      teamId: string;
      originMatchId: string;
    }
  | {
      status: 'ASSIGNED';
      penaltyId: string;
      teamId: string;
      originMatchId: string;
      serveMatchId: string;
    };

export interface LateArrivalPenaltyPlayerRow {
  penaltyId: string;
  userId: string;
  firstName: string;
  lastName: string;
  profilePhotoUrl: string | null;
  state: LateArrivalPenaltyState;
  originMatchId: string;
  assignedServeMatchId: string | null;
}

export interface TeamOutstandingPenaltiesView {
  teamId: string;
  penalties: LateArrivalPenaltyPlayerRow[];
}

export interface DesignatePenaltyServeRequest {
  serveMatchId: string;
}

export interface CancelLateArrivalPenaltyRequest {
  reason?: string;
}

export interface LateArrivalPenaltyActionResponse {
  penaltyId: string;
  state: LateArrivalPenaltyState;
  playerId: string;
  teamId: string;
  originMatchId: string;
  assignedServeMatchId: string | null;
  dischargedAt: string | null;
  cancelledAt: string | null;
}
