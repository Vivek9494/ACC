/**
 * Minimal ScorecardResponse fields needed for the broadcast strip + graphics.
 * Mirrors @acc/types live/scorecard contract (packages/types).
 */

export const LIVE_NAMESPACE = '/live';

export const LiveEvent = {
  Subscribe: 'live:subscribe',
  Unsubscribe: 'live:unsubscribe',
  State: 'live:state',
  GraphicsCommand: 'graphics:command',
} as const;

export type GraphicsCommandAction = 'show' | 'hide' | 'hide_all';

/** Innings-break scorecard tab. Overlay-local; API forwards payload.view as-is. */
export type InningsBreakView =
  | 'batting'
  | 'bowling'
  | 'fow'
  | 'partnerships'
  | 'overs';

function isInningsBreakView(
  value: string,
): value is InningsBreakView {
  return (
    value === 'batting' ||
    value === 'bowling' ||
    value === 'fow' ||
    value === 'partnerships' ||
    value === 'overs'
  );
}

export function parseInningsBreakView(
  value: string | null | undefined,
): InningsBreakView {
  if (value && isInningsBreakView(value)) {
    return value;
  }
  return 'batting';
}

export type GraphicsKind =
  | 'batsman'
  | 'bowler'
  | 'partnership'
  | 'fow'
  | 'innings_break'
  | 'toss'
  | 'chase'
  | 'bowler_career'
  | 'batsman_career'
  | 'toss_result'
  | 'hello';

export interface GraphicsCommandMessage {
  matchId: string;
  action: GraphicsCommandAction;
  graphic?: GraphicsKind;
  payload?: {
    playerId?: string;
    playerIds?: string[];
    view?: InningsBreakView;
  };
}

export interface LiveSubscribeMessage {
  matchId: string;
}

export interface LiveStateMessage {
  matchId: string;
  state: ScorecardResponse | null;
  updatedAt: string;
}

export type DismissalType =
  | 'BOWLED'
  | 'CAUGHT'
  | 'LBW'
  | 'RUN_OUT'
  | 'STUMPED'
  | 'HIT_WICKET'
  | 'RETIRED_OUT'
  | 'OBSTRUCTING_THE_FIELD'
  | 'HIT_THE_BALL_TWICE'
  | 'TIMED_OUT';

export interface BatterCard {
  playerId: string;
  runs: number;
  balls: number;
  /** Off-bat singles (non-boundary). Present on live feed. */
  ones?: number;
  /** Off-bat twos (non-boundary). Present on live feed. */
  twos?: number;
  /** Off-bat threes (non-boundary). Present on live feed. */
  threes?: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  isOut: boolean;
  dismissalType: DismissalType | null;
  bowlerId: string | null;
  fielderId: string | null;
  fielder2Id: string | null;
  retiredHurt: boolean;
  isMankad: boolean;
}

export interface BowlerCard {
  playerId: string;
  legalBalls: number;
  oversText: string;
  runsConceded: number;
  wickets: number;
  maidens: number;
  dotBalls: number;
  economy: number;
}

export interface ExtrasBreakdown {
  wides: number;
  noBalls: number;
  byes: number;
  legByes: number;
  penalties: number;
  total: number;
}

export interface FallOfWicket {
  wicketNumber: number;
  playerId: string;
  teamRuns: number;
  oversText: string;
}

export interface Partnership {
  runs: number;
  balls: number;
  batterIds: string[];
  batterRuns: { playerId: string; runs: number }[];
}

/** A stand closed by a wicket. Same shape as the live current partnership. */
export interface CompletedPartnership {
  batterIds: string[];
  batterRuns: { playerId: string; runs: number }[];
  runs: number;
  balls: number;
}

export interface OverSummary {
  overNumber: number;
  balls: string[];
  runs: number;
  wickets: number;
}

export interface TimelineEntry {
  sequence: number;
  overNumber: number | null;
  ballNumber: number | null;
  label: string;
  code: string;
  runs: number;
  isWicket: boolean;
  isBoundary: boolean;
  description: string;
}

export interface ScorecardInningsLabels {
  inningsId: string | null;
  battingTeamId: string | null;
  battingTeamName: string;
  battingTeamLogoUrl?: string | null;
  bowlingTeamId: string | null;
  bowlingTeamName: string;
}

export interface InningsScorecard {
  inningsId: string | null;
  sequence: number;
  inningsType: string;
  battingTeamId: string | null;
  bowlingTeamId: string | null;
  /** True when the batting side is a name-only external opponent (§9.5). */
  battingIsExternal?: boolean;
  bowlingIsExternal?: boolean;
  runs: number;
  wickets: number;
  legalBalls: number;
  oversText: string;
  oversAllotted: number | null;
  extras?: ExtrasBreakdown;
  batters: BatterCard[];
  bowlers: BowlerCard[];
  fallOfWickets: FallOfWicket[];
  partnership: Partnership | null;
  /** Wicket-to-wicket stands closed before the current partnership. */
  partnerships?: CompletedPartnership[];
  recentOvers?: OverSummary[];
  timeline?: TimelineEntry[];
  currentStrikerId: string | null;
  currentNonStrikerId: string | null;
  currentBowlerId: string | null;
  closed: boolean;
  target: number | null;
}

export interface MatchResultView {
  decided: boolean;
  isTie: boolean;
  isNoResult: boolean;
  winningTeamId?: string | null;
  marginRuns?: number | null;
  marginWickets?: number | null;
  superOverRequired?: boolean;
  note: string | null;
}

export interface ScorecardResponse {
  matchId: string;
  version: number;
  originalTarget: number | null;
  dlsTarget: number | null;
  effectiveTarget: number | null;
  innings: InningsScorecard[];
  result: MatchResultView;
  display: {
    players: Record<string, string>;
    innings: ScorecardInningsLabels[];
  };
}

export type BallType = 'LEATHER' | 'TENNIS';
export type MatchSide = 'TEAM_A' | 'TEAM_B';
export type TossDecision = 'BAT' | 'BOWL';

export interface MatchContext {
  tournamentId: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeTeamName: string | null;
  awayTeamName: string | null;
  externalOpponentName: string | null;
  tossWinner: MatchSide | null;
  tossDecision: TossDecision | null;
  /** Fielding powerplay length (0/null = none). */
  powerplayOvers: number | null;
  /** Persisted prose result line when available. */
  resultNote: string | null;
  /** teamId → presigned logo URL (or null). */
  logosByTeamId: Record<string, string | null>;
  /** Locked matchday squads (Playing XI + roles). */
  squads: MatchSquadContext[];
  /** External opponent roster — the only player records an external side has. */
  externalPlayers: MatchExternalPlayer[];
}

export interface MatchSquadPlayer {
  userId: string;
  firstName: string;
  lastName: string;
  role: string;
  battingOrder: number | null;
}

export interface MatchSquadContext {
  teamId: string;
  players: MatchSquadPlayer[];
}

/** Name-only opponent roster for an ACC leather match (§9.5). */
export interface MatchExternalPlayer {
  /** Same id space as BatterCard.playerId for external sides. */
  id: string;
  slot: number;
  name: string;
}

export interface BroadcastPlayerStatsView {
  userId: string;
  firstName: string;
  lastName: string;
  profilePhotoUrl: string | null;
  ballType: BallType;
  matches: number;
  battingInnings: number;
  runs: number;
  average: number | null;
  strikeRate: number | null;
  highestScore: string | null;
  highestScoreOpponent: string | null;
  highestScoreContext: string | null;
  thirties: number;
  fifties: number;
  wickets: number;
  bowlingAverage: number | null;
  economy: number | null;
  bowlingRunsConceded: number;
  bowlingLegalBalls: number;
  bestBowling: string | null;
  bestBowlingWickets: number | null;
  bestBowlingRunsConceded: number | null;
}

export type ConnectionStatus = 'connecting' | 'live' | 'offline';
