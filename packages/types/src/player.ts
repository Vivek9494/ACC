import type { CaptainFeaturedMatchSummary } from './captain';
import type { ManagerPlayerStats } from './club-manager';
import type { TournamentSummary } from './tournament';

/** Featured match for a player's team (current or next fixture). */
export type PlayerFeaturedMatchSummary = CaptainFeaturedMatchSummary;

/** Player dashboard payload (GET /player/dashboard). */
export interface PlayerDashboard {
  featuredMatch: PlayerFeaturedMatchSummary | null;
  /** Players always have this card — zeros allowed. */
  playerStats: ManagerPlayerStats;
  tournaments: TournamentSummary[];
}
