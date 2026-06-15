import type { CaptainFeaturedMatchSummary } from './captain';
import type { ManagerPlayerStats, MatchSummaryTeamView } from './club-manager';
import type { MatchState } from './match';
import type { TournamentSummary } from './tournament';

/** Featured match for a player's team (current or next fixture). */
export type PlayerFeaturedMatchSummary = CaptainFeaturedMatchSummary;

/**
 * A match the signed-in player may start as the assigned per-match Scorer (§11.1).
 * Only returned when the grant is active and the fixture is on today's calendar day.
 */
export interface ScorerStartableMatch {
  matchId: string;
  tournamentName: string;
  /** Pre-formatted date/time line for the dashboard card, e.g. "SUN, OCT 24 • 10:30 AM". */
  dateTimeLine: string;
  teamA: MatchSummaryTeamView;
  teamB: MatchSummaryTeamView;
  state: MatchState;
  /** False while Playing 11 is not locked for all participating teams. */
  playingXiLocked: boolean;
}

/** Player dashboard payload (GET /player/dashboard). */
export interface PlayerDashboard {
  featuredMatch: PlayerFeaturedMatchSummary | null;
  /** Active scorer grant for a startable match today; null otherwise. */
  scorerMatch: ScorerStartableMatch | null;
  /** Players always have this card — zeros allowed. */
  playerStats: ManagerPlayerStats;
  tournaments: TournamentSummary[];
}
