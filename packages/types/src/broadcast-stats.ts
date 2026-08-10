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
  runs: number;
  /** Batting average (runs ÷ dismissals). */
  average: number | null;
  strikeRate: number | null;
  highestScore: string | null;
  wickets: number;
  /** Bowling average (runs conceded ÷ wickets). */
  bowlingAverage: number | null;
  /** Economy rate (runs conceded ÷ overs). */
  economy: number | null;
  bestBowling: string | null;
}
