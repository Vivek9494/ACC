import type { BallType } from './rbac';

/**
 * Public, read-only career summary for OBS player cards
 * (`GET /broadcast/players/:userId/stats?ballType=`).
 * Minimal projection — no ratings, contact, or drilldowns.
 */
export interface BroadcastPlayerStatsView {
  userId: string;
  firstName: string;
  lastName: string;
  /** Resolved media read URL, or null. */
  profilePhotoUrl: string | null;
  ballType: BallType;
  matches: number;
  /** Batting innings count (distinct from matches). */
  battingInnings: number;
  runs: number;
  /** Batting average (runs ÷ dismissals). */
  average: number | null;
  strikeRate: number | null;
  highestScore: string | null;
  highestScoreOpponent: string | null;
  /** Venue/year line for highest score, when available. */
  highestScoreContext: string | null;
  /** Innings scoring 30–49 (does not overlap with fifties). */
  thirties: number;
  /** Half-centuries (50–99). */
  fifties: number;
  wickets: number;
  /** Bowling average (runs conceded ÷ wickets). */
  bowlingAverage: number | null;
  /** Economy rate (runs conceded ÷ overs). */
  economy: number | null;
  /** Career runs conceded while bowling (for live merge). */
  bowlingRunsConceded: number;
  /** Career legal balls bowled (for live merge). */
  bowlingLegalBalls: number;
  bestBowling: string | null;
  bestBowlingWickets: number | null;
  bestBowlingRunsConceded: number | null;
}
