/**
 * Minimal ScorecardResponse fields needed for the broadcast strip.
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

export interface BatterCard {
  playerId: string;
  runs: number;
  balls: number;
  isOut: boolean;
}

export interface BowlerCard {
  playerId: string;
  oversText: string;
  runsConceded: number;
  wickets: number;
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

export type ConnectionStatus = 'connecting' | 'live' | 'offline';
