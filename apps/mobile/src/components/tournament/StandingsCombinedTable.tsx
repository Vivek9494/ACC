import type { StandingsTableSection } from '@acc/types';
import { ScrollView, View } from 'react-native';

import { INPUT_SHADOW_STYLE } from '../ui/fieldStyles';
import { TeamAvatar } from '../ui/TeamAvatar';
import { Text } from '../ui/Text';
import {
  STANDINGS_STAT_COLUMNS,
  STANDINGS_STAT_COL_WIDTH,
  STANDINGS_PTS_COL_WIDTH,
  STANDINGS_NRR_COL_WIDTH,
  STANDINGS_STATS_MIN_WIDTH,
  StandingsStatsDataRow,
} from './StandingsTableStats';

function CombinedTableHeaderRow(): React.ReactElement {
  return (
    <View className="flex-row items-center border-b border-separator bg-surface-container-low px-3 py-2">
      <View className="min-w-[140px] flex-1">
        <Text className="font-sans-medium text-[10px] uppercase tracking-wider text-on-surface-variant">
          Team
        </Text>
      </View>
      <View style={{ minWidth: STANDINGS_STATS_MIN_WIDTH }}>
        <View className="flex-row items-center pr-3">
          {STANDINGS_STAT_COLUMNS.map((column) => (
            <Text
              key={column}
              className={`text-center font-sans-medium text-[9px] uppercase tracking-wider ${
                column === 'W'
                  ? 'text-primary'
                  : column === 'L'
                    ? 'text-secondary-900'
                    : 'text-on-surface-variant'
              }`}
              style={{ width: STANDINGS_STAT_COL_WIDTH }}
            >
              {column}
            </Text>
          ))}
          <View
            className="rounded-l-control bg-primary-container px-1 py-1"
            style={{ width: STANDINGS_PTS_COL_WIDTH }}
          >
            <Text className="text-center font-sans-bold text-[9px] uppercase tracking-wider text-primary">
              PTS
            </Text>
          </View>
          <Text
            className="text-right font-sans-medium text-[9px] uppercase tracking-wider text-on-surface-variant"
            style={{ width: STANDINGS_NRR_COL_WIDTH }}
          >
            NRR
          </Text>
        </View>
      </View>
    </View>
  );
}

export interface StandingsCombinedTableProps {
  section: StandingsTableSection;
}

/** Round-robin points table — one combined standings card for the whole tournament. */
export function StandingsCombinedTable({
  section,
}: StandingsCombinedTableProps): React.ReactElement {
  const lastIndex = section.teams.length - 1;

  return (
    <View
      className="overflow-hidden rounded-control border border-outline-variant bg-surface"
      style={INPUT_SHADOW_STYLE}
    >
      <ScrollView horizontal bounces={false} showsHorizontalScrollIndicator={false}>
        <View className="min-w-full">
          <CombinedTableHeaderRow />
          {section.teams.map((row, index) => (
            <View
              key={row.teamId}
              className={`flex-row items-center ${
                index < lastIndex ? 'border-b border-separator' : ''
              }`}
            >
              <View className="min-w-[140px] flex-1 flex-row items-center gap-2 px-3 py-3">
                <TeamAvatar name={row.teamName} logoUrl={row.logoUrl} size="xs" />
                <Text className="flex-1 font-sans-bold text-sm text-on-surface" numberOfLines={2}>
                  {row.teamName}
                </Text>
              </View>
              <StandingsStatsDataRow row={row} showBottomDivider={false} />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
