import { View } from 'react-native';

import type { DashboardFeaturedMatchEntry } from '../../lib/dashboard-featured-match';
import { MatchSummaryCard } from '../ui/MatchSummaryCard';
import { DashboardFeaturedMatchCarousel } from './DashboardFeaturedMatchCarousel';

const DASHBOARD_MATCH_CAROUSEL_MIN_COUNT = 3;

export interface DashboardFeaturedMatchDayGroupProps {
  entries: DashboardFeaturedMatchEntry[];
  onPress: (matchId: string) => void;
}

/** One venue-local day on the home dashboard: stack (1–2) or carousel (3+). */
export function DashboardFeaturedMatchDayGroup({
  entries,
  onPress,
}: DashboardFeaturedMatchDayGroupProps): React.ReactElement {
  if (entries.length >= DASHBOARD_MATCH_CAROUSEL_MIN_COUNT) {
    return <DashboardFeaturedMatchCarousel entries={entries} onPress={onPress} />;
  }

  return (
    <View className="gap-4">
      {entries.map((entry) => (
        <MatchSummaryCard
          key={entry.matchId}
          {...entry.card}
          onPress={() => onPress(entry.matchId)}
        />
      ))}
    </View>
  );
}
