import type { DashboardFeaturedMatchEntry } from '../../lib/dashboard-featured-match';
import { DashboardFeaturedMatchList } from './DashboardFeaturedMatchList';

export interface DashboardFeaturedMatchDayGroupProps {
  entries: DashboardFeaturedMatchEntry[];
  onPress: (matchId: string) => void;
}

/**
 * @deprecated Prefer {@link DashboardFeaturedMatchList} (Live/Upcoming sections).
 * Kept for any remaining day-grouped call sites: 1 → single card, 2+ → carousel.
 */
export function DashboardFeaturedMatchDayGroup({
  entries,
  onPress,
}: DashboardFeaturedMatchDayGroupProps): React.ReactElement | null {
  return <DashboardFeaturedMatchList entries={entries} onPress={onPress} />;
}
