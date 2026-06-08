/**
 * Match setup contracts shared between the api and mobile (spec §5.2, §11).
 * Single source of truth for the match state machine, toss data, the locked
 * matchday squad (§9.7, §8) and the per-match Scorer grant (§11.1).
 */

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
 * Scheduled → Playing 11 Locked → Toss Completed → Live → Completed →
 * Scorecard Locked. Delayed/Rain Interrupted are recoverable side states;
 * Cancelled / No Result are terminal-ish (No Result still locks a scorecard).
 */
export const MATCH_STATE_TRANSITIONS: Record<MatchState, MatchState[]> = {
  SCHEDULED: ['PLAYING_XI_LOCKED', 'DELAYED', 'CANCELLED'],
  PLAYING_XI_LOCKED: ['TOSS_COMPLETED', 'DELAYED', 'CANCELLED'],
  TOSS_COMPLETED: ['LIVE', 'DELAYED', 'CANCELLED'],
  DELAYED: ['PLAYING_XI_LOCKED', 'TOSS_COMPLETED', 'LIVE', 'CANCELLED'],
  LIVE: ['RAIN_INTERRUPTED', 'COMPLETED', 'NO_RESULT', 'CANCELLED'],
  RAIN_INTERRUPTED: ['LIVE', 'COMPLETED', 'NO_RESULT', 'CANCELLED'],
  COMPLETED: ['SCORECARD_LOCKED'],
  NO_RESULT: ['SCORECARD_LOCKED'],
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
  /** Home/system side. Required for a system-vs-system match. */
  homeTeamId?: string | null;
  /** Away/system side; omit for an ACC match against an external opponent. */
  awayTeamId?: string | null;
  /** ACC external opponent name (§9.5) when there is no system away team. */
  externalOpponentName?: string | null;
  matchCode?: string | null;
  matchDate?: string | null;
  startTime?: string | null;
  reportingTime?: string | null;
  groundLocation?: string | null;
  youtubeUrl?: string | null;
}

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

// --- Read projections -------------------------------------------------------

export interface MatchSummary {
  id: string;
  tournamentId: string;
  matchCode: string | null;
  state: MatchState;
  homeTeamId: string | null;
  homeTeamName: string | null;
  awayTeamId: string | null;
  awayTeamName: string | null;
  externalOpponentName: string | null;
  matchDate: string | null;
  startTime: string | null;
}

export interface SquadPlayerView {
  userId: string;
  firstName: string;
  lastName: string;
  role: MatchSquadRole;
  isActiveImpact: boolean;
  battingOrder: number | null;
}

export interface SquadView {
  teamId: string;
  teamName: string;
  lockedByUserId: string;
  lockedAt: string;
  players: SquadPlayerView[];
}

export interface ScorerGrantView {
  userId: string;
  firstName: string;
  lastName: string;
  grantedByUserId: string | null;
  grantedAt: string;
}

export interface MatchDetail extends MatchSummary {
  reportingTime: string | null;
  groundLocation: string | null;
  youtubeUrl: string | null;
  tossWinner: MatchSide | null;
  tossDecision: TossDecision | null;
  impactPlayerEnabled: boolean;
  squads: SquadView[];
  activeScorers: ScorerGrantView[];
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
  /** Derived/persisted match winner; null for a tie/No Result. */
  winningTeamId: string | null;
  isNoResult: boolean;
}

/** A selectable player for the Playing-11 screen (§9.7). */
export interface SquadCandidate {
  userId: string;
  firstName: string;
  lastName: string;
  battingStyle: string | null;
  bowlingStyle: string | null;
  /** §9.7: shown with a "Suspended" badge; allowed in XI, never as substitute. */
  isSuspended: boolean;
}
