/**
 * Minimal ScorecardResponse fields needed for the broadcast strip + graphics.
 * Mirrors @acc/types live/scorecard contract (packages/types).
 */

export const LIVE_NAMESPACE = '/live';

export const LiveEvent = {
  Subscribe: 'live:subscribe',
  Unsubscribe: 'live:unsubscribe',
  State: 'live:state',
} as const;

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

export interface ScorecardInningsLabels {
  inningsId: string | null;
  battingTeamId: string | null;
  battingTeamName: string;
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
  currentStrikerId: string | null;
  currentNonStrikerId: string | null;
  currentBowlerId: string | null;
  closed: boolean;
  target: number | null;
}

export interface ScorecardResponse {
  matchId: string;
  version: number;
  originalTarget: number | null;
  dlsTarget: number | null;
  effectiveTarget: number | null;
  innings: InningsScorecard[];
  result: {
    decided: boolean;
    isTie: boolean;
    isNoResult: boolean;
    note: string | null;
  };
  display: {
    players: Record<string, string>;
    innings: ScorecardInningsLabels[];
  };
}

export type BallType = 'LEATHER' | 'TENNIS';

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
  bestBowling: string | null;
}

export type ConnectionStatus = 'connecting' | 'live' | 'offline';
