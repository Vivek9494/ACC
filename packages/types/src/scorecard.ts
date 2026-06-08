/**
 * Scorecard confirmation & post-match contracts (spec §13, §16) shared between
 * the api and mobile. Covers the post-match confirmation flow (§13.1), the
 * 5-hour auto-confirm window (§13.1, §23), post-confirmation edits (§13.2),
 * Man of the Match (§13.3) and the PDF export (§16).
 */

/**
 * §13.1: the Captain OR Vice Captain has 5 hours from match completion to
 * confirm the scorecard; otherwise the System auto-confirms. The window is
 * measured from the completion timestamp in UTC (§23).
 */
export const SCORECARD_CONFIRM_WINDOW_HOURS = 5;
export const SCORECARD_CONFIRM_WINDOW_MS = SCORECARD_CONFIRM_WINDOW_HOURS * 60 * 60 * 1000;

/** Audit `actorLabel` used for the System auto-confirm event (§13.1, §18.1). */
export const SYSTEM_ACTOR_LABEL = 'System';

/** Audit action names for the §13 / §18.1 scorecard-lifecycle events. */
export const ScorecardAuditAction = {
  Confirmed: 'SCORECARD_CONFIRMED',
  AutoConfirmed: 'SCORECARD_AUTO_CONFIRMED',
  PostConfirmEdit: 'SCORECARD_POST_CONFIRM_EDIT',
  ManOfMatchSelected: 'MAN_OF_MATCH_SELECTED',
} as const;
export type ScorecardAuditAction =
  (typeof ScorecardAuditAction)[keyof typeof ScorecardAuditAction];

// --- Requests --------------------------------------------------------------

/** Captain/VC confirms the scorecard, locking the match (§13.1). */
export interface ConfirmScorecardRequest {
  /** Optional optimistic-concurrency guard against a stale view (§12.3). */
  expectedVersion?: number;
}

/** Captain selects the Man of the Match after the game (§13.3). */
export interface SelectManOfMatchRequest {
  /** A user id drawn from either team's locked Playing 11. */
  userId: string;
}

// --- Read projections -------------------------------------------------------

/** Post-match confirmation status for a match (§13.1). */
export interface ScorecardConfirmationView {
  matchId: string;
  /** Current match state (`COMPLETED`, `SCORECARD_LOCKED`, …). */
  state: string;
  /** When the match was completed (UTC ISO); null before completion. */
  completedAt: string | null;
  /** When the scorecard was confirmed/locked (UTC ISO); null if not yet. */
  confirmedAt: string | null;
  /** The confirming user; null when auto-confirmed by the System. */
  confirmedByUserId: string | null;
  /** True when the System auto-confirmed after the window elapsed (§13.1). */
  autoConfirmed: boolean;
  /** Deadline by which a manual confirmation must happen (UTC ISO). */
  autoConfirmDueAt: string | null;
  /** True while a manual Captain/VC confirmation is still possible. */
  withinConfirmWindow: boolean;
  manOfTheMatchUserId: string | null;
  winningTeamId: string | null;
  isNoResult: boolean;
}
