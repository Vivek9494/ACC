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
  average: number | null;
  strikeRate: number | null;
  highestScore: string | null;
  wickets: number;
  bestBowling: string | null;
}
