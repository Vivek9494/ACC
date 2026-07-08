import type { TeamStandingRow } from '@acc/types';
import { formatSignedNetRunRate } from '@acc/types';
import { ScrollView, View } from 'react-native';

import { TeamAvatar } from '../ui/TeamAvatar';
import { Text } from '../ui/Text';

export const STANDINGS_STAT_COLUMNS = ['M', 'W', 'L', 'NR'] as const;
export const STANDINGS_STAT_COL_WIDTH = 26;
export const STANDINGS_PTS_COL_WIDTH = 34;
export const STANDINGS_NRR_COL_WIDTH = 56;
export const STANDINGS_STATS_MIN_WIDTH =
  STANDINGS_STAT_COLUMNS.length * STANDINGS_STAT_COL_WIDTH +
  STANDINGS_PTS_COL_WIDTH +
  STANDINGS_NRR_COL_WIDTH;

/** Fixed width for the pinned team column (Points Table split layout). */
export const STANDINGS_PINNED_TEAM_COL_WIDTH = 152;

/**
 * Fixed row height for Points Table — fits xs avatar (36px) with vertical centering.
 * Applied identically on pinned team cells AND stats rows to prevent vertical drift.
 */
export const PT_ROW_HEIGHT = 48;

/** Fixed header row height — identical on pinned TEAM header and stats header. */
export const PT_HEADER_HEIGHT = 36;

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

function StandingsStatsHeaderCells(): React.ReactElement {
  return (
    <View
      className="flex-row items-center pr-3"
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

export function StandingsStatsHeaderRow({
  height = PT_HEADER_HEIGHT,
}: {
  height?: number;
}): React.ReactElement {
  return (
    <View
      className="justify-center border-b border-separator bg-surface-container-low"
      style={{ height }}
    >
      <StandingsStatsHeaderCells />
    </View>
  );
}

function StandingsPinnedTeamHeaderCell(): React.ReactElement {
  return (
    <View
      className="justify-center border-b border-separator bg-surface-container-low px-3"
      style={{ height: PT_HEADER_HEIGHT, width: STANDINGS_PINNED_TEAM_COL_WIDTH }}
    >
      <Text className="font-sans-medium text-[10px] uppercase tracking-wider text-on-surface-variant">
        Team
      </Text>
    </View>
  );
}

function StandingsPinnedTeamDataCell({
  name,
  logoUrl,
  groupLabel,
  showBottomDivider = false,
  height = PT_ROW_HEIGHT,
}: {
  name: string;
  logoUrl: string | null;
  groupLabel?: string;
  showBottomDivider?: boolean;
  height?: number;
}): React.ReactElement {
  return (
    <View
      className={`flex-row items-center gap-2 px-3 ${showBottomDivider ? 'border-b border-separator' : ''}`}
      style={{ height, width: STANDINGS_PINNED_TEAM_COL_WIDTH }}
    >
      <TeamAvatar name={name} logoUrl={logoUrl} size="xs" />
      <View className="min-w-0 flex-1">
        <Text className="font-sans-bold text-sm text-on-surface" numberOfLines={1}>
          {name}
        </Text>
        {groupLabel ? (
          <Text className="font-sans text-[10px] text-on-surface-variant" numberOfLines={1}>
            {groupLabel}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Points Table body — pinned team column + horizontally scrollable stats grid.
 * Row heights are fixed on both sides so parallel lists stay vertically aligned.
 */
/** Row height when a group label is shown under the team name (list view). */
export const PT_ROW_HEIGHT_WITH_GROUP_LABEL = 56;

export function StandingsPinnedSplitTableBody({
  teams,
  groupLabelByTeamId,
}: {
  teams: TeamStandingRow[];
  groupLabelByTeamId?: Record<string, string>;
}): React.ReactElement {
  const lastIndex = teams.length - 1;
  const rowHeight = groupLabelByTeamId ? PT_ROW_HEIGHT_WITH_GROUP_LABEL : PT_ROW_HEIGHT;

  return (
    <View className="flex-row">
      <View className="shrink-0">
        <StandingsPinnedTeamHeaderCell />
        {teams.map((row, index) => (
          <StandingsPinnedTeamDataCell
            key={row.teamId}
            name={row.teamName}
            logoUrl={row.logoUrl}
            groupLabel={groupLabelByTeamId?.[row.teamId]}
            showBottomDivider={index < lastIndex}
            height={rowHeight}
          />
        ))}
      </View>

      <ScrollView
        horizontal
        bounces={false}
        showsHorizontalScrollIndicator={false}
        className="flex-1"
      >
        <View>
          <StandingsStatsHeaderRow />
          {teams.map((row, index) => (
            <StandingsStatsDataRow
              key={row.teamId}
              row={row}
              showBottomDivider={index < lastIndex}
              height={rowHeight}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

export function StandingsStatsDataRow({
  row,
  showBottomDivider = true,
  height,
}: {
  row: TeamStandingRow;
  showBottomDivider?: boolean;
  /** When set, row uses this exact height (Points Table split layout). */
  height?: number;
}): React.ReactElement {
  return (
    <View
      className={`flex-row items-center pr-3 ${showBottomDivider ? 'border-b border-separator' : ''}`}
      style={{
        minWidth: STANDINGS_STATS_MIN_WIDTH,
        ...(height != null ? { height } : {}),
      }}
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
        className="justify-center rounded-l-control bg-primary-container px-1 py-1.5"
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
