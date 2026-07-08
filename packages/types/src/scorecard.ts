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

/** Human-readable countdown until the §13.1 auto-confirm deadline. */
export function formatAutoConfirmCountdown(iso: string | null | undefined): string {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'now';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

/** Whether the current user may award Man of the Match on a completed match. */
export interface ManOfMatchEligibilityView {
  /** A registered winning team exists (MoM applies; includes after a pick for re-select). */
  offered: boolean;
  /** The authenticated user is the winning team's Captain or Vice-Captain. */
  canSelect: boolean;
  /** MoM is mandatory and not yet selected (§13.3 end-of-day deadline). */
  required: boolean;
  /** End of the match calendar day by which MoM should be selected (UTC ISO). */
  dueAt: string | null;
  /** Past the deadline with no selection — still selectable (§13.3). */
  overdue: boolean;
}

/** Whether the current user may manually confirm the scorecard (§13.1). */
export const ScorecardConfirmSide = {
  Home: 'HOME',
  Away: 'AWAY',
  Admin: 'ADMIN',
} as const;
export type ScorecardConfirmSide =
  (typeof ScorecardConfirmSide)[keyof typeof ScorecardConfirmSide];

export interface TeamScorecardConfirmationView {
  teamId: string | null;
  confirmed: boolean;
  confirmedByUserId: string | null;
  confirmedAt: string | null;
}

/** Minimal match fields for two-sided confirmation derivation. */
export interface ScorecardConfirmationTeamsInput {
  state: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeTeamConfirmed: boolean;
  awayTeamConfirmed: boolean;
  adminConfirmed: boolean;
}

/** True when both participating sides confirmed or an admin override locked the card. */
export function isScorecardFinalized(match: ScorecardConfirmationTeamsInput): boolean {
  if (match.state === 'SCORECARD_LOCKED' || match.adminConfirmed) {
    return true;
  }
  const homeOk = match.homeTeamId == null || match.homeTeamConfirmed;
  const awayOk = match.awayTeamId == null || match.awayTeamConfirmed;
  return homeOk && awayOk;
}

/** True when the scorecard is locked (§13.1) — independent of match `state`. */
export function isScorecardLocked(
  match: ScorecardConfirmationTeamsInput & { confirmedAt?: string | Date | null },
): boolean {
  if (match.state === 'SCORECARD_LOCKED') {
    return true;
  }
  return match.confirmedAt != null;
}

export interface ScorecardConfirmEligibilityView {
  /** Match is in COMPLETED or NO_RESULT awaiting confirmation. */
  awaitingConfirmation: boolean;
  /** User may submit a confirmation action now. */
  canConfirm: boolean;
  /** Which side the user confirms — home, away, or admin override. */
  confirmSide: ScorecardConfirmSide | null;
  scorecardFinalized: boolean;
  homeTeam: TeamScorecardConfirmationView;
  awayTeam: TeamScorecardConfirmationView;
  adminConfirmed: boolean;
}

/** Captain/VC dashboard prompt for a match awaiting their team's confirmation (§13.1). */
export interface PendingScorecardConfirmationCardView {
  matchId: string;
  tournamentName: string;
  homeTeamName: string;
  awayTeamName: string;
  /** The participating side this user confirms (home or away). */
  confirmSide: typeof ScorecardConfirmSide.Home | typeof ScorecardConfirmSide.Away;
  homeTeamConfirmed: boolean;
  awayTeamConfirmed: boolean;
  /** UTC ISO deadline for the 5-hour auto-confirm window. */
  autoConfirmDueAt: string | null;
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
  /** Both sides confirmed or admin override applied. */
  scorecardFinalized: boolean;
  homeTeamConfirmed: boolean;
  homeTeamConfirmedByUserId: string | null;
  homeTeamConfirmedAt: string | null;
  awayTeamConfirmed: boolean;
  awayTeamConfirmedByUserId: string | null;
  awayTeamConfirmedAt: string | null;
  adminConfirmed: boolean;
  adminConfirmedByUserId: string | null;
  adminConfirmedAt: string | null;
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
