import { View } from 'react-native';

import type { DashboardFeaturedMatchEntry } from '../../lib/dashboard-featured-match';
import { MatchSummaryCard } from '../ui/MatchSummaryCard';
import { DashboardFeaturedMatchCarousel } from './DashboardFeaturedMatchCarousel';

/** Carousel when 2+ matches; single card when exactly one. */
const DASHBOARD_MATCH_CAROUSEL_MIN_COUNT = 2;

export interface DashboardFeaturedMatchListProps {
  entries: DashboardFeaturedMatchEntry[];
  onPress: (matchId: string) => void;
}

/** Featured match list for a dashboard section (Live or Upcoming). */
export function DashboardFeaturedMatchList({
  entries,
  onPress,
}: DashboardFeaturedMatchListProps): React.ReactElement | null {
  if (entries.length === 0) {
    return null;
  }

  if (entries.length >= DASHBOARD_MATCH_CAROUSEL_MIN_COUNT) {
    return <DashboardFeaturedMatchCarousel entries={entries} onPress={onPress} />;
  }

  const entry = entries[0]!;
  return (
    <View>
      <MatchSummaryCard {...entry.card} onPress={() => onPress(entry.matchId)} />
    </View>
  );
}
