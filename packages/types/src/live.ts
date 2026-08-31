/**
 * Real-time live-score protocol (spec §29 — Socket.IO push; §28 — live
 * display). The scorer mutates state over REST; the server recomputes the full
 * {@link ScorecardResponse}, caches it in Redis, and pushes it to every
 * subscriber of the match room. Guests subscribe read-only, no auth (spec §2).
 *
 * Broadcast graphics (OBS overlay) use the same namespace: operators emit
 * {@link LiveEvent.GraphicsCommand}; the server forwards room-scoped only.
 */

import type { ScorecardResponse } from './scoring';

/** Socket.IO event names exchanged on the live namespace. */
export const LiveEvent = {
  /** Client → server: join a match room. Payload {@link LiveSubscribeMessage}. */
  Subscribe: 'live:subscribe',
  /** Client → server: leave a match room. Payload {@link LiveSubscribeMessage}. */
  Unsubscribe: 'live:unsubscribe',
  /** Server → client: acknowledges a subscription. */
  Subscribed: 'live:subscribed',
  /** Server → client: a full live-state snapshot/update. */
  State: 'live:state',
  /** Server → match room: outgoing scorer revoked mid-match (Admin/CM swap). */
  ScorerRevoked: 'live:scorer-revoked',
  /**
   * Client → server → match room: OBS graphics show/hide (pure forward).
   * Payload {@link GraphicsCommandMessage}.
   */
  GraphicsCommand: 'graphics:command',
} as const;
export type LiveEvent = (typeof LiveEvent)[keyof typeof LiveEvent];

/** The Socket.IO namespace the live gateway is mounted on. */
export const LIVE_NAMESPACE = '/live';

/** Authenticated user notification namespace (scorer swap, dashboard refresh). */
export const USER_NAMESPACE = '/user';

/** Socket.IO room for a signed-in user. */
export function userNotificationRoom(userId: string): string {
  return `user:${userId}`;
}

/** User-namespace events (authenticated). */
export const UserEvent = {
  /** Server → user room: this user gained per-match scoring access. */
  ScorerAssigned: 'user:scorer-assigned',
} as const;
export type UserEvent = (typeof UserEvent)[keyof typeof UserEvent];

/** Redis key for a match's cached live state (spec §29 live match cache). */
export function liveStateCacheKey(matchId: string): string {
  return `live:match:${matchId}`;
}

/** Socket.IO room name for a match. */
export function liveMatchRoom(matchId: string): string {
  return `match:${matchId}`;
}

export interface LiveSubscribeMessage {
  matchId: string;
}

export interface LiveSubscribedMessage {
  matchId: string;
  /** True when a cached snapshot was delivered immediately on subscribe. */
  hasSnapshot: boolean;
}

/** A pushed live-state frame. `state` is null only when nothing is cached yet. */
export interface LiveStateMessage {
  matchId: string;
  state: ScorecardResponse | null;
  /** Server timestamp (UTC ISO-8601) the frame was produced. */
  updatedAt: string;
}

/** Why the scorer's grant was revoked mid-session. */
export const ScorerRevokedReason = {
  Swap: 'swap',
  Cancelled: 'cancelled',
} as const;
export type ScorerRevokedReason = (typeof ScorerRevokedReason)[keyof typeof ScorerRevokedReason];

/** Emitted to the match room when the per-match scorer loses access mid-match. */
export interface LiveScorerRevokedMessage {
  matchId: string;
  /** Outgoing scorer whose grant was revoked. */
  userId: string;
  reason?: ScorerRevokedReason;
}

/** Emitted to the incoming scorer's user room after a mid-match swap. */
export interface UserScorerAssignedMessage {
  matchId: string;
}

/** On-air graphic kinds for the OBS graphics overlay (v1 — no MOTM). */
export const GraphicsKind = {
  Batsman: 'batsman',
  Bowler: 'bowler',
  Partnership: 'partnership',
  FallOfWicket: 'fow',
  InningsBreak: 'innings_break',
  /**
   * Strip-only: replace CRR | overs-remaining with the toss line.
   * No full-screen graphic on graphics.html.
   */
  Toss: 'toss',
  /**
   * Strip-only: replace CRR | overs-remaining with runs needed off balls left.
   * No full-screen graphic on graphics.html.
   */
  Chase: 'chase',
  /**
   * Strip-only: replace center sub-line with innings FOURS / SIXES totals.
   */
  Boundaries: 'boundaries',
  /**
   * Full-screen career bowling card (replaces score strip while on air).
   */
  BowlerCareer: 'bowler_career',
  /**
   * Full-screen batsman career profile card (separate from in-play batsman).
   */
  BatsmanCareer: 'batsman_career',
  /**
   * Centered pre-match toss result card (teams + logos + decision).
   * Distinct from strip-only `toss` (CRR override).
   */
  TossResult: 'toss_result',
  /**
   * Centered both-teams Playing XI card (home left / away-or-external right).
   * Match-level; not tied to an innings.
   */
  PlayingXi: 'playing_xi',
  /**
   * Full-screen wagon wheel (shot placement from saved shotX/shotY).
   * Match-level; subject + filter select which shots to draw.
   */
  WagonWheel: 'wagon_wheel',
  /** Tournament-wide points table (all matches in the tournament). */
  PointsTable: 'points_table',
  /** Top 5 batters by runs in the tournament. */
  TournamentTopBatsmen: 'tournament_top_batsmen',
  /** Top 5 bowlers by wickets in the tournament. */
  TournamentTopBowlers: 'tournament_top_bowlers',
  /** Total fours hit across the tournament. */
  TournamentFours: 'tournament_fours',
  /** Total sixes hit across the tournament. */
  TournamentSixes: 'tournament_sixes',
  /** Phase A validation only — remove once real graphics ship. */
  Hello: 'hello',
} as const;
export type GraphicsKind = (typeof GraphicsKind)[keyof typeof GraphicsKind];

export const GraphicsCommandAction = {
  Show: 'show',
  Hide: 'hide',
  HideAll: 'hide_all',
} as const;
export type GraphicsCommandAction =
  (typeof GraphicsCommandAction)[keyof typeof GraphicsCommandAction];

export interface GraphicsCommandPayload {
  playerId?: string;
  playerIds?: string[];
  /** Innings-break / scorecard graphic view tab. */
  view?: 'batting' | 'bowling' | 'fow' | 'partnerships' | 'overs';
  inningsId?: string | null;
  /** `break` = full innings-break card; `scorecard` = team bowling/partnerships view. */
  source?: 'break' | 'scorecard';
  teamId?: string | null;
  /** Playing XI card layout. */
  variant?: 'both' | 'single' | 'lineup';
  /**
   * Wagon wheel subject: literal `team` (all batters) or a batter user/external id.
   */
  subject?: 'team' | string;
  /**
   * Wagon wheel filter over saved shotX/shotY points.
   * Team options use `4s` / `6s` / `4s6s`; batter options use `all`.
   */
  filter?: '4s' | '6s' | '4s6s' | 'all';
}

/** Room-scoped OBS graphics control (unauthenticated; pure forward). */
export interface GraphicsCommandMessage {
  matchId: string;
  action: GraphicsCommandAction;
  graphic?: GraphicsKind;
  payload?: GraphicsCommandPayload;
}

/** Shown to the outgoing scorer when their grant is revoked mid-match (organizer swap). */
export const SCORER_REVOKED_MID_MATCH_MESSAGE =
  'Tournament organizer swapped you with another scorer. We are revoking your scoring access of the match.';

/** Shown when the match is cancelled while the scorer is on the scoring screen. */
export const SCORER_REVOKED_MATCH_CANCELLED_MESSAGE =
  'This match was cancelled by the tournament organizer. Your scoring access has been revoked.';
