import type { MatchState } from './match';
import type { TournamentDashboardEntry } from './center-sevak';
import type { TournamentSummary } from './tournament';

export type { TournamentDashboardEntry, TournamentDashboardPermissions } from './center-sevak';

/** One team row on the manager dashboard featured match card. */
export interface MatchSummaryTeamView {
  name: string;
  logoUrl: string | null;
  score: string | null;
  overs: string | null;
  isWinner: boolean;
}

/** Featured / most-recent match for the Club Manager home screen. */
export interface FeaturedMatchSummary {
  matchId: string;
  tournamentName: string;
  state: MatchState;
  teamA: MatchSummaryTeamView;
  teamB: MatchSummaryTeamView;
  /** Human result line, e.g. "Barrie Cobras won by 40 runs". Null when live/upcoming. */
  resultNote: string | null;
  isLive: boolean;
  isUpcoming: boolean;
}

/** Aggregated player stats for a manager who is also a registered player. */
export interface ManagerPlayerStats {
  matches: number;
  runs: number;
  wickets: number;
}

/** Club Manager dashboard payload (GET /club-manager/dashboard). */
export interface ClubManagerDashboard {
  featuredMatch: FeaturedMatchSummary | null;
  /** Null when the manager has no tournament registration (not a player); zeros allowed. */
  playerStats: ManagerPlayerStats | null;
  tournaments: TournamentDashboardEntry[];
}
