import type { CaptainFeaturedMatchSummary } from './captain';
import type { DashboardPlayerPerformance } from './club-manager';
import type { ParticipationPollCardView } from './poll';
import type { TournamentSummary } from './tournament';

/** Per-tournament actions for the current user (computed server-side). */
export interface TournamentDashboardPermissions {
  canEdit: boolean;
  canDelete: boolean;
  canManageCenterPlayers: boolean;
}

/** One tournament row on a role dashboard, with permitted menu actions. */
export interface TournamentDashboardEntry {
  tournament: TournamentSummary;
  permissions: TournamentDashboardPermissions;
}

/** Center Sevak dashboard payload (GET /center-sevak/dashboard). */
export interface CenterSevakDashboard {
  featuredMatches: CaptainFeaturedMatchSummary[];
  /** Leather-ball participation poll for the sevak's next open fixture on their roster, if any. */
  participationPoll: ParticipationPollCardView | null;
  /** Center Sevaks are always players — zeros when no match data yet. */
  playerStats: DashboardPlayerPerformance;
  tournaments: TournamentDashboardEntry[];
}
