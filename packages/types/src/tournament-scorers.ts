import { canMidMatchSwapMatchScorer } from './match';
import { type AuthUser, UserRole } from './auth';
import type { PlayerRegistrationRole } from './registration';
import { BallType, CitySelection, type BallType as BallTypeValue } from './rbac';
import type { TournamentScopeDisplay } from './tournament';

/** Shared tennis tournament scorer pool size (Phase 1). */
export const TOURNAMENT_SCORER_COUNT = 5;

/** One assigned tournament scorer (registered player). */
export interface TournamentScorerRow {
  userId: string;
  firstName: string;
  lastName: string;
  centerId: string;
  centerName: string;
  playerRole: PlayerRegistrationRole | null;
  profilePhotoUrl: string | null;
}

/** Confirmed registrant eligible for scorer selection. */
export type TournamentScorerPoolRow = TournamentScorerRow;

/** GET /tournaments/:id/scorers — current set + selection pool. */
export interface TournamentScorersSelectionView {
  scorers: TournamentScorerRow[];
  pool: TournamentScorerPoolRow[];
  canManage: boolean;
  /** True when a match is LIVE or RAIN_INTERRUPTED — pool edits are blocked. */
  scorersEditLocked: boolean;
  scorersEditLockedMessage: string | null;
}

export interface SetTournamentScorersRequest {
  userIds: string[];
}

/** One upcoming match whose per-match scorer was cleared after pool removal. */
export interface ResetMatchScorerMatchView {
  matchId: string;
  /** Human label: teams, optional code, optional date. */
  label: string;
  matchCode: string | null;
  matchDate: string | null;
}

/** Per removed tournament scorer: matches reset in the same transaction. */
export interface RemovedScorerMatchResetView {
  userId: string;
  firstName: string;
  lastName: string;
  resetMatches: ResetMatchScorerMatchView[];
}

export interface SetTournamentScorersResponse {
  scorers: TournamentScorerRow[];
  /** Non-empty entries only when a removed scorer had eligible upcoming assignments cleared. */
  removedScorerResets: RemovedScorerMatchResetView[];
}

/** Build an informational alert body when upcoming match scorers were cleared. */
export function formatRemovedScorerResetAlert(
  resets: readonly RemovedScorerMatchResetView[],
): string | null {
  const withMatches = resets.filter((entry) => entry.resetMatches.length > 0);
  if (withMatches.length === 0) {
    return null;
  }

  return withMatches
    .map((entry) => {
      const name = `${entry.firstName} ${entry.lastName}`.trim();
      const count = entry.resetMatches.length;
      const matchWord = count === 1 ? 'match' : 'matches';
      const lines = entry.resetMatches.map((match) => `• ${match.label}`);
      return [
        `${name} was assigned as scorer for ${count} ${matchWord}. Please assign a new scorer.`,
        ...lines,
      ].join('\n');
    })
    .join('\n\n');
}

/** Assigned match scorer with stale flag when removed from the tournament pool. */
export interface MatchAssignedScorerView {
  userId: string;
  firstName: string;
  lastName: string;
  grantedByUserId: string | null;
  grantedAt: string;
  /** True when the user is no longer in the current TournamentScorer set. */
  isStale: boolean;
}

/** Tennis-only match detail scorer picker state (Phase 2). */
export interface MatchTennisScorerView {
  tournamentScorerCount: number;
  canManageMatchScorer: boolean;
  canManageTournamentScorers: boolean;
  /** True when a match is LIVE or RAIN_INTERRUPTED — pool edits are blocked. */
  scorersEditLocked: boolean;
  scorersEditLockedMessage: string | null;
  /** True when this match is live or finished — per-match scorer picker is blocked. */
  matchScorerEditLocked: boolean;
  matchScorerEditLockedMessage: string | null;
  /** Admin/Club Manager may swap the scorer mid-match via "Change Scorer" (DP1/DP2). */
  canMidMatchSwapScorer: boolean;
  pickableScorers: TournamentScorerRow[];
  assignedScorer: MatchAssignedScorerView | null;
}

export const SCORER_NOT_IN_TOURNAMENT_SET_ERROR = 'SCORER_NOT_IN_TOURNAMENT_SET';

/** Tennis live scoring blocked when no per-match scorer is assigned. */
export const NO_MATCH_SCORER_ASSIGNED_ERROR = 'NO_MATCH_SCORER_ASSIGNED';

export const NO_MATCH_SCORER_ASSIGNED_MESSAGE =
  'No scorer assigned — assign one first.';

export interface EnterScoringSessionResponse {
  ok: true;
}

export const SCORERS_LOCKED_LIVE_MATCH_ERROR = 'SCORERS_LOCKED_LIVE_MATCH';

export const SCORERS_LOCKED_LIVE_MATCH_MESSAGE =
  "Can't change scorers while a match is in progress";

/** Fields needed to evaluate tennis scorer-management visibility. */
export interface TournamentScorerManagementContext {
  ballType: BallTypeValue;
  scopeDisplay: TournamentScopeDisplay;
  participatingCenterIds: string[];
}

/** Province-wide tennis tournament (APL / "All Centers"). */
export function isAllCentersTennisScope(scope: TournamentScopeDisplay): boolean {
  return scope.citySelection === CitySelection.All;
}

/** Center-level tennis tournament with explicit participating centers. */
export function isParticipatingCentersTennisScope(scope: TournamentScopeDisplay): boolean {
  return (
    scope.citySelection === CitySelection.Multi || scope.citySelection === CitySelection.Single
  );
}

/**
 * Tennis Phase 1: Admin; Club Manager on all-centers; participating Center Sevak on multi/single-center.
 */
export function canManageTournamentScorers(
  user: AuthUser | null | undefined,
  tournament: TournamentScorerManagementContext | null | undefined,
): boolean {
  if (!user || !tournament) {
    return false;
  }
  if (tournament.ballType !== BallType.Tennis) {
    return false;
  }
  if (user.role === UserRole.Admin) {
    return true;
  }

  if (isAllCentersTennisScope(tournament.scopeDisplay)) {
    return user.role === UserRole.ClubManager;
  }

  if (isParticipatingCentersTennisScope(tournament.scopeDisplay)) {
    const sevakCenterIds = user.centerSevakCenterIds ?? [];
    return sevakCenterIds.some((centerId) =>
      tournament.participatingCenterIds.includes(centerId),
    );
  }

  return false;
}
