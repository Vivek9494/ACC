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
  /** A user id from the winning team's locked Playing 11. */
  userId: string;
}

/**
 * MoM must be selected by end of the match calendar day (UTC date from `matchDate`,
 * or the completion date when unset).
 */
export function computeManOfMatchDueAt(
  matchDate: string | null | undefined,
  completedAt: string | null | undefined,
): string | null {
  const dateOnly =
    (matchDate && /^\d{4}-\d{2}-\d{2}/.test(matchDate) ? matchDate.slice(0, 10) : null) ??
    (completedAt ? completedAt.slice(0, 10) : null);
  if (!dateOnly) {
    return null;
  }
  return `${dateOnly}T23:59:59.999Z`;
}

/** True when the end-of-day MoM deadline has passed and no player was selected. */
export function isManOfMatchOverdue(
  dueAt: string | null | undefined,
  manOfTheMatchUserId: string | null | undefined,
): boolean {
  if (!dueAt || manOfTheMatchUserId) {
    return false;
  }
  return Date.now() > new Date(dueAt).getTime();
}

/** Whether the current user may award Man of the Match on a completed match. */
export interface ManOfMatchEligibilityView {
  /** A registered winning team exists and MoM is not yet set. */
  offered: boolean;
  /** The authenticated user is the winning team's Captain (or VC when Captain is suspended). */
  canSelect: boolean;
  /** MoM is mandatory for registered winning teams (§13.3). */
  required: boolean;
  /** End of the match calendar day by which MoM should be selected (UTC ISO). */
  dueAt: string | null;
  /** Past the deadline with no selection — still selectable (§13.3). */
  overdue: boolean;
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
  /** When the winning captain confirmed MoM (UTC ISO); null until selected. */
  manOfTheMatchSelectedAt: string | null;
  /** Captain/VC who selected MoM; null until selected. */
  manOfTheMatchSelectedByUserId: string | null;
  /** End of match-day deadline for MoM (UTC ISO). */
  manOfMatchDueAt: string | null;
  /** Past deadline with no MoM — still selectable (§13.3). */
  manOfMatchOverdue: boolean;
  winningTeamId: string | null;
  isNoResult: boolean;
}
