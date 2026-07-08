import { TabEmptyState, TabEmptyStateIconCircle } from '../ui/TabEmptyState';

/** Leaderboard tab empty state — no player stats yet (§15.5). */
export function TournamentLeaderboardEmptyState(): React.ReactElement {
  return (
    <TabEmptyState
      icon={<TabEmptyStateIconCircle name="trophy-outline" />}
      message="No records found in Leaderboard"
    />
  );
}
