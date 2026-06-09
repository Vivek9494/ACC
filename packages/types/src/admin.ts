/** Admin dashboard aggregate counts (GET /admin/overview). */
export interface AdminOverview {
  provinceCount: number;
  centerCount: number;
  activeTournamentCount: number;
  totalUserCount: number;
  tournamentCount: number;
  matchesTodayCount: number;
  pendingApprovalsCount: number;
}
