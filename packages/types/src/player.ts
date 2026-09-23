import type { CaptainFeaturedMatchSummary } from './captain';
import type { DashboardPlayerPerformance, MatchSummaryTeamView } from './club-manager';
import type { MatchState } from './match';
import type { ParticipationPollCardView } from './poll';
import type { TournamentSummary } from './tournament';

/** Featured match for a player's team (current or next fixture). */
export type PlayerFeaturedMatchSummary = CaptainFeaturedMatchSummary;

/**
 * True when the assigned scorer should open the live scoring cockpit (§11.1).
 * Matches Match Details "Continue Scoring": LIVE / rain — even before an innings
 * row exists (recovery via startScoring on the score screen).
 */
export function isScorerMatchResumable(
  state: MatchState,
  _hasScoringSession?: boolean,
): boolean {
  return state === 'LIVE' || state === 'RAIN_INTERRUPTED';
}

/**
 * A match the signed-in player may start or continue as the assigned per-match Scorer (§11.1).
 * Only returned when the grant is active and the fixture is on today's calendar day.
 * Pre-live states → "Start Match"; LIVE / rain-interrupted → "Continue Scoring".
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
  /**
   * True once at least one innings row exists. Informational for the score UI;
   * LIVE / rain always use "Continue Scoring" (same as Match Details).
   */
  hasScoringSession: boolean;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeTeamFinalized: boolean;
  awayTeamFinalized: boolean;
  bothTeamsFinalized: boolean;
  /** True when Playing XI is confirmed on both sides and the 30-minute pre-start window is open. */
  canStartMatch: boolean;
  /** ISO UTC instant when Start Match unlocks (scheduled kickoff − 30 min). */
  startAllowedAt: string | null;
  /** Venue-local display line for {@link startAllowedAt}, e.g. `Jul 5 • 6:30 AM EDT`. */
  startAllowedAtLine: string | null;
  /** Why Start Match is blocked when {@link canStartMatch} is false. */
  startMatchBlockedReason: 'PLAYING_XI' | 'TOO_EARLY' | null;
}

/** Player dashboard payload (GET /player/dashboard). */
export interface PlayerDashboard {
  liveMatches: PlayerFeaturedMatchSummary[];
  upcomingMatches: PlayerFeaturedMatchSummary[];
  /** Leather-ball participation poll for the player's next open fixture, if any. */
  participationPoll: ParticipationPollCardView | null;
  /** Active scorer grant for a startable match today; null otherwise. */
  scorerMatch: ScorerStartableMatch | null;
  /** Players always have this card — zeros allowed. */
  playerStats: DashboardPlayerPerformance;
  tournaments: TournamentSummary[];
}
