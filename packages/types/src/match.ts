/**
 * Match setup contracts shared between the api and mobile (spec §5.2, §11).
 * Single source of truth for the match state machine, toss data, the locked
 * matchday squad (§9.7, §8) and the per-match Scorer grant (§11.1).
 */

import { APP_SHORT_NAME } from './app-branding';

import type { RegistrationPlayerType } from './registration';
import { type AuthUser, UserRole } from './auth';
import { BallType } from './rbac';
import type { MatchTennisScorerView } from './tournament-scorers';
import { canManageTournamentScorers } from './tournament-scorers';
import { canViewAdminUsersDirectory } from './admin';
import type { OverlayThemeKey } from './overlay-theme';

/** Match states (spec §5.2). */
export const MatchState = {
  Scheduled: 'SCHEDULED',
  PlayingXiLocked: 'PLAYING_XI_LOCKED',
  TossCompleted: 'TOSS_COMPLETED',
  Live: 'LIVE',
  Delayed: 'DELAYED',
  RainInterrupted: 'RAIN_INTERRUPTED',
  Cancelled: 'CANCELLED',
  NoResult: 'NO_RESULT',
  Completed: 'COMPLETED',
  ScorecardLocked: 'SCORECARD_LOCKED',
} as const;
export type MatchState = (typeof MatchState)[keyof typeof MatchState];

export const MATCH_STATE_LABELS: Record<MatchState, string> = {
  SCHEDULED: 'Scheduled',
  PLAYING_XI_LOCKED: 'Playing 11 Locked',
  TOSS_COMPLETED: 'Toss Completed',
  LIVE: 'Live',
  DELAYED: 'Delayed',
  RAIN_INTERRUPTED: 'Rain Interrupted',
  CANCELLED: 'Cancelled',
  NO_RESULT: 'No Result',
  COMPLETED: 'Completed',
  SCORECARD_LOCKED: 'Scorecard Locked',
};

/**
 * Allowed match-state transitions (§5.2). The happy path is
 * Scheduled → Playing 11 Locked → Toss Completed → Live → Completed.
 * Scorecard lock (§13.1) is tracked via confirmation fields, not a state change.
 * Delayed/Rain Interrupted are recoverable side states; Cancelled / No Result are terminal.
 */
export const MATCH_STATE_TRANSITIONS: Record<MatchState, MatchState[]> = {
  SCHEDULED: ['PLAYING_XI_LOCKED', 'DELAYED', 'CANCELLED'],
  PLAYING_XI_LOCKED: ['TOSS_COMPLETED', 'DELAYED', 'CANCELLED'],
  TOSS_COMPLETED: ['LIVE', 'DELAYED', 'CANCELLED'],
  DELAYED: ['PLAYING_XI_LOCKED', 'TOSS_COMPLETED', 'LIVE', 'CANCELLED'],
  LIVE: ['RAIN_INTERRUPTED', 'COMPLETED', 'NO_RESULT', 'CANCELLED'],
  RAIN_INTERRUPTED: ['LIVE', 'COMPLETED', 'NO_RESULT', 'CANCELLED'],
  COMPLETED: [],
  NO_RESULT: [],
  CANCELLED: [],
  SCORECARD_LOCKED: [],
};

/** Match states at which the per-match Scorer grant is auto-revoked (§11.1). */
export const MATCH_END_STATES: MatchState[] = [
  MatchState.Completed,
  MatchState.NoResult,
  MatchState.Cancelled,
  MatchState.ScorecardLocked,
];

/**
 * Match states in which ball-by-ball scoring is active (§12) — same values the
 * scoring engine accepts via `SCORABLE_STATES`.
 */
export const LIVE_MATCH_STATES: MatchState[] = [MatchState.Live, MatchState.RainInterrupted];

/**
 * Pre-live fixture states where a per-match scorer assignment may be cleared when
 * a player is removed from the tournament scorer pool.
 */
export const PRE_LIVE_MATCH_STATES: MatchState[] = [
  MatchState.Scheduled,
  MatchState.Delayed,
  MatchState.PlayingXiLocked,
  MatchState.TossCompleted,
];

/** True when the fixture has not yet gone Live (status-based, not date-based). */
export function isPreLiveMatchState(state: MatchState): boolean {
  return PRE_LIVE_MATCH_STATES.includes(state);
}

/** Targets reachable only after the match is underway (Match Detail status controls). */
export const IN_PLAY_ONLY_STATUS_TARGETS: MatchState[] = [
  MatchState.RainInterrupted,
  MatchState.Completed,
  MatchState.NoResult,
];

/** §5.2 states that use dedicated endpoints — excluded from generic status buttons. */
export const MATCH_DETAIL_DEDICATED_TRANSITION_STATES: MatchState[] = [
  MatchState.PlayingXiLocked,
  MatchState.TossCompleted,
  MatchState.ScorecardLocked,
];

export const MATCH_SCORER_CHANGE_LOCKED_LIVE_ERROR = 'MATCH_SCORER_CHANGE_LOCKED_LIVE';

export const MATCH_SCORER_CHANGE_LOCKED_LIVE_MESSAGE =
  "Can't change the scorer while the match is in progress.";

export const MATCH_SCORER_CHANGE_LOCKED_FINAL_ERROR = 'MATCH_SCORER_CHANGE_LOCKED_FINAL';

export const MATCH_SCORER_CHANGE_LOCKED_FINAL_MESSAGE =
  'The match scorer cannot be changed after the match is finished.';

/** Whether the per-match scorer picker is blocked for this fixture state. */
export function resolveMatchScorerEditLock(state: MatchState): {
  locked: boolean;
  message: string | null;
  error: string | null;
} {
  if (LIVE_MATCH_STATES.includes(state)) {
    return {
      locked: true,
      message: MATCH_SCORER_CHANGE_LOCKED_LIVE_MESSAGE,
      error: MATCH_SCORER_CHANGE_LOCKED_LIVE_ERROR,
    };
  }
  if (MATCH_END_STATES.includes(state)) {
    return {
      locked: true,
      message: MATCH_SCORER_CHANGE_LOCKED_FINAL_MESSAGE,
      error: MATCH_SCORER_CHANGE_LOCKED_FINAL_ERROR,
    };
  }
  return { locked: false, message: null, error: null };
}

/** One of a match's two sides (spec §11.2 toss inputs). */
export const MatchSide = {
  TeamA: 'TEAM_A',
  TeamB: 'TEAM_B',
} as const;
export type MatchSide = (typeof MatchSide)[keyof typeof MatchSide];

/** Toss decision (spec §11.2). */
export const TossDecision = {
  Bat: 'BAT',
  Bowl: 'BOWL',
} as const;
export type TossDecision = (typeof TossDecision)[keyof typeof TossDecision];

/** Fixture stage for manual match setup (§11). */
export const MatchType = {
  LeagueMatch: 'LEAGUE_MATCH',
  PreQuarterFinal: 'PRE_QUARTER_FINAL',
  QuarterFinal: 'QUARTER_FINAL',
  SemiFinal: 'SEMI_FINAL',
  Final: 'FINAL',
  SuperLeague: 'SUPER_LEAGUE',
  Qualifier1: 'QUALIFIER_1',
  Qualifier2: 'QUALIFIER_2',
  Eliminator: 'ELIMINATOR',
  SuperEight: 'SUPER_EIGHT',
} as const;
export type MatchType = (typeof MatchType)[keyof typeof MatchType];

/**
 * Knockout (cross-group) round types. These matches pair teams from different
 * groups, so no Group is required and teams are not filtered to a single group.
 * SUPER_LEAGUE / SUPER_EIGHT are league-style phases and are NOT knockout.
 */
export const KNOCKOUT_MATCH_TYPES: readonly MatchType[] = [
  MatchType.PreQuarterFinal,
  MatchType.QuarterFinal,
  MatchType.SemiFinal,
  MatchType.Final,
  MatchType.Qualifier1,
  MatchType.Qualifier2,
  MatchType.Eliminator,
];

/** True for cross-group knockout round types — group is optional for these. */
export function isKnockoutMatchType(type: MatchType | string | null | undefined): boolean {
  return type != null && (KNOCKOUT_MATCH_TYPES as readonly string[]).includes(type);
}

export const MATCH_TYPE_LABELS: Record<MatchType, string> = {
  LEAGUE_MATCH: 'League Match',
  PRE_QUARTER_FINAL: 'Pre Quarter Final',
  QUARTER_FINAL: 'Quarter Final',
  SEMI_FINAL: 'Semi Final',
  FINAL: 'Final',
  SUPER_LEAGUE: 'Super League',
  QUALIFIER_1: 'Qualifier 1',
  QUALIFIER_2: 'Qualifier 2',
  ELIMINATOR: 'Eliminator',
  SUPER_EIGHT: 'Super Eight',
};

/** Ground-setup responsibility on ACC schedule entries (spec §27). */
export const HomeAway = {
  Home: 'HOME',
  Away: 'AWAY',
} as const;
export type HomeAway = (typeof HomeAway)[keyof typeof HomeAway];

export const HOME_AWAY_LABELS: Record<HomeAway, string> = {
  HOME: 'Home',
  AWAY: 'Away',
};

/** Match Detail copy — which side sets up stumps and boundary cones. */
export function formatMatchGroundSetupLabel(homeAway: HomeAway): string {
  if (homeAway === HomeAway.Home) {
    return `Home (${APP_SHORT_NAME} team sets up stumps & boundary cones)`;
  }
  return 'Away (Opponent team sets up stumps & boundary cones)';
}

/** Role of a player within a locked matchday squad (spec §9.7, §8). */
export const MatchSquadRole = {
  PlayingXi: 'PLAYING_XI',
  Substitute: 'SUBSTITUTE',
  ImpactCandidate: 'IMPACT_CANDIDATE',
} as const;
export type MatchSquadRole = (typeof MatchSquadRole)[keyof typeof MatchSquadRole];

/** Squad size rules (spec §9.7, §8). */
export const PLAYING_XI_SIZE = 11;
export const MAX_SUBSTITUTES = 2;
/** Up to 3 Impact Player candidates per team; one is the active 12th (§8). */
export const MAX_IMPACT_CANDIDATES = 3;

/**
 * §31 #4 decision (Impact Player 12th selection): we adopt model **(a)** — the
 * Captain designates up to {@link MAX_IMPACT_CANDIDATES} candidates and picks
 * ONE as the active 12th at Playing-11 lock time (IPL-style, simpler than
 * deciding at bring-in). The active candidate carries `isActiveImpact = true`.
 */
export const IMPACT_PLAYER_SELECTION_MODEL = 'LOCK_TIME_SINGLE_ACTIVE' as const;

// --- Requests --------------------------------------------------------------

/** Create a match / fixture entry (§11, §27). */
export interface CreateMatchRequest {
  /** Home/system side (Team A). Required for system-vs-system fixtures. */
  homeTeamId?: string | null;
  /** Away/system side (Team B); omit for an ACC match against an external opponent. */
  awayTeamId?: string | null;
  /** ACC external opponent name (§9.5) when there is no system away team. */
  externalOpponentName?: string | null;
  /** Group-stage fixture group (nullable for round robin / manual). */
  groupId?: string | null;
  matchCode?: string | null;
  /** Fixture stage (required for all scheduling variants). */
  matchType?: MatchType | null;
  /** Tournament calendar day (YYYY-MM-DD, UTC). */
  matchDate?: string | null;
  /** Scheduled start (ISO 8601 UTC). */
  startTime?: string | null;
  reportingTime?: string | null;
  groundLocation?: string | null;
  geofenceLat?: number | null;
  geofenceLng?: number | null;
  oversPerInnings?: number | null;
  maxOversPerBowler?: number | null;
  /** Fielding-restriction powerplay length; optional (0 = none). */
  powerplayOvers?: number | null;
  /** Tennis-ball batting powerplay; optional (0 = none). Ignored for leather. */
  battingPowerplayOvers?: number | null;
  /** ACC ground-setup responsibility (§27); optional. */
  homeAway?: HomeAway | null;
  youtubeUrl?: string | null;
  /** Broadcast overlay theme key — per-match (`apps/scoring-overlay` registry). */
  overlayTheme?: OverlayThemeKey | null;
}

/** Update an upcoming match fixture — same fields as create (§11). */
export type UpdateMatchRequest = CreateMatchRequest;

/** Lock a team's Playing 11 + substitutes (+ impact candidates) — §9.7, §8. */
export interface LockPlayingXiRequest {
  teamId: string;
  /** Exactly {@link PLAYING_XI_SIZE} user ids. */
  playingXi: string[];
  /** Up to {@link MAX_SUBSTITUTES}; suspended players are not allowed here. */
  substitutes: string[];
  /** Up to {@link MAX_IMPACT_CANDIDATES}; only when Impact Player is enabled. */
  impactCandidates?: string[];
  /** The active 12th — must be one of `impactCandidates` (§31 #4(a)). */
  activeImpactUserId?: string | null;
}

/** Record toss data only — no animation (§11.2). */
export interface RecordTossRequest {
  tossWinner: MatchSide;
  decision: TossDecision;
}

/** Scorer flow: record toss, derive innings sides, and begin Live scoring (§11.2). */
export type StartScoringRequest = RecordTossRequest;

/** Toss + opening players at match start; transitions the match to Live (§11). */
export interface StartMatchSetupRequest {
  tossWinner: MatchSide;
  tossDecision: TossDecision;
  strikerUserId: string;
  nonStrikerUserId: string;
  bowlerUserId: string;
}

export interface TransitionMatchStateRequest {
  state: MatchState;
}

/** Assign a per-match Scorer (§11.1). */
export interface AssignScorerRequest {
  userId: string;
}

/** Mid-match Scorer handover (§11.1): revoke `fromUserId`, grant `toUserId`. */
export interface HandoverScorerRequest {
  fromUserId?: string | null;
  toUserId: string;
}

/** Admin/Club Manager mid-match scorer swap — incoming user from the tournament pool of 5. */
export interface SwapMatchScorerRequest {
  userId: string;
}

/**
 * Platform roles that may override the live-match scorer lock via "Change Scorer".
 * Reuses the Admin/Club Manager directory signal (DP2).
 */
export function canMidMatchSwapMatchScorer(role: UserRole | undefined): boolean {
  return role !== undefined && canViewAdminUsersDirectory(role);
}

// --- Read projections -------------------------------------------------------

export interface MatchSummary {
  id: string;
  tournamentId: string;
  /** Tournament display name (from tournament relation). */
  tournamentName: string;
  /** Tournament organizer user id — drives organizer-scoped Club Manager actions. */
  tournamentCreatedByUserId: string;
  /** Tournament ball type — drives tennis vs leather scorer flows. */
  ballType: BallType;
  matchCode: string | null;
  matchType: MatchType;
  state: MatchState;
  homeTeamId: string | null;
  homeTeamName: string | null;
  awayTeamId: string | null;
  awayTeamName: string | null;
  externalOpponentName: string | null;
  /** ACC ground-setup responsibility (§27); null on older fixtures. */
  homeAway: HomeAway | null;
  matchDate: string | null;
  startTime: string | null;
  /** Cumulative pre-live delay in minutes; original startTime unchanged. */
  delayMinutes: number;
}

export interface SquadPlayerView {
  userId: string;
  firstName: string;
  lastName: string;
  role: MatchSquadRole;
  isActiveImpact: boolean;
  battingOrder: number | null;
}

import type { PenaltyServingPlayerView } from './suspension';

export interface SquadView {
  teamId: string;
  teamName: string;
  lockedByUserId: string;
  lockedAt: string;
  isFinalized: boolean;
  finalizedByUserId: string | null;
  finalizedAt: string | null;
  players: SquadPlayerView[];
  /** Suspended players sitting out this match (not in the Playing 11). */
  penaltyServing: PenaltyServingPlayerView[];
}

export interface ScorerGrantView {
  userId: string;
  firstName: string;
  lastName: string;
  grantedByUserId: string | null;
  grantedAt: string;
}

export interface MatchDetail extends MatchSummary {
  groupId: string | null;
  /** Group display name when `groupId` is set (group-stage fixtures). */
  groupName: string | null;
  reportingTime: string | null;
  groundLocation: string | null;
  /** Geofence centre latitude (leather matches). */
  geofenceLat: number | null;
  /** Geofence centre longitude (leather matches). */
  geofenceLng: number | null;
  /** Tournament venue IANA timezone for local display. */
  tournamentTimezone: string | null;
  /** Tournament default overs when the match row has no per-match value. */
  tournamentOversPerInnings: number | null;
  oversPerInnings: number | null;
  maxOversPerBowler: number | null;
  powerplayOvers: number | null;
  battingPowerplayOvers: number | null;
  youtubeUrl: string | null;
  /** Broadcast overlay theme — per-match selection from registered themes. */
  overlayTheme: OverlayThemeKey;
  tossWinner: MatchSide | null;
  tossDecision: TossDecision | null;
  /** Derived from toss when recorded — team batting first in innings 1. */
  battingFirstTeamId: string | null;
  /** Derived from toss when recorded — team bowling first in innings 1. */
  bowlingFirstTeamId: string | null;
  openingStrikerUserId: string | null;
  openingNonStrikerUserId: string | null;
  openingBowlerUserId: string | null;
  impactPlayerEnabled: boolean;
  squads: SquadView[];
  activeScorers: ScorerGrantView[];
  /** Live-added external opponent batters (§9.5). */
  externalPlayers: ExternalPlayerView[];
  /** §13.1: when the match was completed (UTC ISO) — start of the confirm window. */
  completedAt: string | null;
  /** §13.1: when the scorecard was confirmed/locked (UTC ISO). */
  confirmedAt: string | null;
  /** §13.1: the confirming user; null when the System auto-confirmed. */
  confirmedByUserId: string | null;
  /** §13.1: true when the System auto-confirmed after the 5-hour window. */
  autoConfirmed: boolean;
  /** §13.3: the selected Man of the Match, if any. */
  manOfTheMatchUserId: string | null;
  manOfTheMatchSelectedAt: string | null;
  manOfTheMatchSelectedByUserId: string | null;
  resultNote: string | null;
  /** Derived/persisted match winner; null for a tie/No Result. */
  winningTeamId: string | null;
  isNoResult: boolean;
  /** Tennis Phase 2: per-match scorer picker state; null for leather. */
  tennisScorer: MatchTennisScorerView | null;
}

/** A selectable player for the Playing-11 screen (§9.7). */
export interface SquadCandidate {
  userId: string;
  firstName: string;
  lastName: string;
  battingStyle: string | null;
  bowlingStyle: string | null;
  /** Leather registration player type; null for tennis or unset. */
  playerType: RegistrationPlayerType | null;
  /** §9.7: shown with a "Suspended" badge; allowed in XI, never as substitute. */
  isSuspended: boolean;
}

/** Live-added external opponent batter for an ACC match (§9.5). */
export interface ExternalPlayerView {
  id: string;
  matchId: string;
  slot: number;
  name: string;
  battingStyle: string | null;
  bowlingType: string | null;
}

/** Add a name-only batter to the external opponent's match roster (§9.5). */
export interface AddExternalBatsmanRequest {
  name: string;
  battingStyle?: string | null;
}

/** Pre-match opponent roster entry (§9.5) — same shape as live external players. */
export type AddOpponentPlayerRequest = Pick<AddExternalBatsmanRequest, 'name'>;

/** Rename a name-only external opponent player (§9.5 runtime typo correction). */
export type UpdateOpponentPlayerRequest = Pick<AddExternalBatsmanRequest, 'name'>;

/** Add a name-only bowler to the external opponent's match roster (§9.5). */
export interface AddExternalBowlerRequest {
  name: string;
  bowlingType?: string | null;
}

/** Audit actions for match participant changes. */
export const MatchAuditAction = {
  ExternalBatsmanAdded: 'EXTERNAL_BATSMAN_ADDED',
  ExternalBowlerAdded: 'EXTERNAL_BOWLER_ADDED',
  ExternalPlayerRenamed: 'EXTERNAL_PLAYER_RENAMED',
} as const;
export type MatchAuditAction = (typeof MatchAuditAction)[keyof typeof MatchAuditAction];

/** Active per-match scorer id from the tennis picker view; null when unassigned or stale. */
export function assignedMatchScorerUserId(
  tennisScorer: MatchTennisScorerView | null | undefined,
): string | null {
  if (!tennisScorer?.assignedScorer || tennisScorer.assignedScorer.isStale) {
    return null;
  }
  return tennisScorer.assignedScorer.userId;
}

export interface MatchTossSummaryInput {
  tossWinner: MatchSide | null;
  tossDecision: TossDecision | null;
  homeTeamName: string | null;
  awayTeamName: string | null;
  externalOpponentName: string | null;
}

/** Human-readable toss line for live/completed scorecards and dashboard cards. */
export function formatMatchTossSummaryLine(match: MatchTossSummaryInput): string | null {
  if (!match.tossWinner || !match.tossDecision) {
    return null;
  }
  const winnerName =
    match.tossWinner === MatchSide.TeamA
      ? (match.homeTeamName ?? 'Home')
      : (match.awayTeamName ?? match.externalOpponentName ?? 'Away');
  const decisionWord = match.tossDecision === TossDecision.Bat ? 'bat' : 'bowl';
  return `${winnerName} won the toss and chose to ${decisionWord}`;
}

/**
 * Tennis: assigned match scorer + Admin/tournament organizers (DP1). Leather: unchanged
 * visibility — show whenever Playing 11 is locked; server enforces RECORD_TOSS (DP3).
 */
export function canShowRecordToss(
  user: AuthUser | null | undefined,
  match: Pick<MatchDetail, 'state' | 'ballType' | 'tennisScorer'>,
): boolean {
  if (match.state !== MatchState.PlayingXiLocked) {
    return false;
  }

  if (match.ballType !== BallType.Tennis) {
    return true;
  }

  if (!user || !match.tennisScorer) {
    return false;
  }

  if (user.role === UserRole.Admin || match.tennisScorer.canManageTournamentScorers) {
    return true;
  }

  const assignedScorerId = assignedMatchScorerUserId(match.tennisScorer);
  return assignedScorerId !== null && user.id === assignedScorerId;
}
