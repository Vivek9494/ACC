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

export type GraphicsKind =
  | 'batsman'
  | 'bowler'
  | 'partnership'
  | 'fow'
  | 'innings_break'
  | 'toss'
  | 'chase'
  | 'bowler_career'
  | 'hello';

export interface GraphicsCommandMessage {
  matchId: string;
  action: GraphicsCommandAction;
  graphic?: GraphicsKind;
  payload?: { playerId?: string; playerIds?: string[] };
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
  oversText: string;
  runsConceded: number;
  wickets: number;
  maidens?: number;
  economy?: number;
  legalBalls?: number;
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
  runs: number;
  wickets: number;
  legalBalls: number;
  oversText: string;
  oversAllotted: number | null;
  batters: BatterCard[];
  bowlers: BowlerCard[];
  fallOfWickets: FallOfWicket[];
  partnership: Partnership | null;
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
}

export interface BroadcastPlayerStatsView {
  userId: string;
  firstName: string;
  lastName: string;
  profilePhotoUrl: string | null;
  ballType: BallType;
  matches: number;
  runs: number;
  average: number | null;
  strikeRate: number | null;
  highestScore: string | null;
  wickets: number;
  bowlingAverage: number | null;
  economy: number | null;
  bestBowling: string | null;
}

export type ConnectionStatus = 'connecting' | 'live' | 'offline';
