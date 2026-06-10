import type { FeaturedMatchSummary, ManagerPlayerStats } from './club-manager';
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
  featuredMatch: FeaturedMatchSummary | null;
  /** Center Sevaks are always players — zeros when no match data yet. */
  playerStats: ManagerPlayerStats;
  tournaments: TournamentDashboardEntry[];
}
