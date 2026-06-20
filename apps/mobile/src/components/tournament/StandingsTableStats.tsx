import type { TeamStandingRow } from '@acc/types';
import { formatSignedNetRunRate } from '@acc/types';
import { View } from 'react-native';

import { Text } from '../ui/Text';

export const STANDINGS_STAT_COLUMNS = ['M', 'W', 'L', 'NR'] as const;
export const STANDINGS_STAT_COL_WIDTH = 26;
export const STANDINGS_PTS_COL_WIDTH = 34;
export const STANDINGS_NRR_COL_WIDTH = 56;
export const STANDINGS_STATS_MIN_WIDTH =
  STANDINGS_STAT_COLUMNS.length * STANDINGS_STAT_COL_WIDTH +
  STANDINGS_PTS_COL_WIDTH +
  STANDINGS_NRR_COL_WIDTH;

function statValue(row: TeamStandingRow, column: (typeof STANDINGS_STAT_COLUMNS)[number]): number {
  switch (column) {
    case 'M':
      return row.matches;
    case 'W':
      return row.wins;
    case 'L':
      return row.losses;
    case 'NR':
      return row.noResults;
  }
}

function headerClass(column: (typeof STANDINGS_STAT_COLUMNS)[number] | 'PTS' | 'NRR'): string {
  if (column === 'W') {
    return 'text-primary';
  }
  if (column === 'L') {
    return 'text-secondary-900';
  }
  if (column === 'PTS') {
    return 'font-sans-bold text-primary';
  }
  return 'text-on-surface-variant';
}

function dataClass(column: (typeof STANDINGS_STAT_COLUMNS)[number] | 'PTS' | 'NRR'): string {
  if (column === 'W') {
    return 'text-primary';
  }
  if (column === 'L') {
    return 'text-secondary-900';
  }
  if (column === 'PTS') {
    return 'font-sans-bold text-primary';
  }
  return 'text-on-surface-variant';
}

export function StandingsStatsHeaderRow(): React.ReactElement {
  return (
    <View
      className="flex-row items-center border-b border-separator py-2 pr-3"
      style={{ minWidth: STANDINGS_STATS_MIN_WIDTH }}
    >
      {STANDINGS_STAT_COLUMNS.map((column) => (
        <Text
          key={column}
          className={`text-center font-sans-medium text-[9px] uppercase tracking-wider ${headerClass(column)}`}
          style={{ width: STANDINGS_STAT_COL_WIDTH }}
        >
          {column}
        </Text>
      ))}
      <View
        className="rounded-l-control bg-primary-container px-1 py-1"
        style={{ width: STANDINGS_PTS_COL_WIDTH }}
      >
        <Text
          className={`text-center text-[9px] uppercase tracking-wider ${headerClass('PTS')}`}
        >
          PTS
        </Text>
      </View>
      <Text
        className={`text-right font-sans-medium text-[9px] uppercase tracking-wider ${headerClass('NRR')}`}
        style={{ width: STANDINGS_NRR_COL_WIDTH }}
      >
        NRR
      </Text>
    </View>
  );
}

export function StandingsStatsDataRow({
  row,
  showBottomDivider = true,
}: {
  row: TeamStandingRow;
  showBottomDivider?: boolean;
}): React.ReactElement {
  return (
    <View
      className={`flex-row items-center py-3 pr-3 ${showBottomDivider ? 'border-b border-separator' : ''}`}
      style={{ minWidth: STANDINGS_STATS_MIN_WIDTH }}
    >
      {STANDINGS_STAT_COLUMNS.map((column) => (
        <Text
          key={column}
          className={`text-center font-sans text-xs ${dataClass(column)}`}
          style={{ width: STANDINGS_STAT_COL_WIDTH }}
        >
          {statValue(row, column)}
        </Text>
      ))}
      <View
        className="rounded-l-control bg-primary-container px-1 py-2"
        style={{ width: STANDINGS_PTS_COL_WIDTH }}
      >
        <Text className={`text-center text-xs ${dataClass('PTS')}`}>{row.points}</Text>
      </View>
      <Text
        className={`text-right font-sans text-xs ${dataClass('NRR')}`}
        style={{ width: STANDINGS_NRR_COL_WIDTH }}
      >
        {formatSignedNetRunRate(row.netRunRate)}
      </Text>
    </View>
  );
}
