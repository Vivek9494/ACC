import type { MatchState } from './match';
import type { ManagerPlayerStats, MatchSummaryTeamView } from './club-manager';
import type { TournamentSummary } from './tournament';

/** Featured match presentation on the Captain / Vice-Captain home screen. */
export type CaptainFeaturedMatchStatus = 'UPCOMING' | 'LIVE' | 'COMPLETED';

/** Featured match for a captain's team (current or next fixture). */
export interface CaptainFeaturedMatchSummary {
  matchId: string;
  tournamentName: string;
  state: MatchState;
  status: CaptainFeaturedMatchStatus;
  teamA: MatchSummaryTeamView;
  teamB: MatchSummaryTeamView;
  /** Toss / pre-match line shown while live or before a result (blue text). */
  infoLine: string | null;
  /** Completed-match result line, e.g. "Barrie Cobras won by 40 runs". */
  resultLine: string | null;
}

/** Captain / Vice-Captain dashboard payload (GET /captain/dashboard). */
export interface CaptainDashboard {
  featuredMatch: CaptainFeaturedMatchSummary | null;
  /** Captains and VCs are always players — zeros allowed. */
  playerStats: ManagerPlayerStats;
  tournaments: TournamentSummary[];
}
