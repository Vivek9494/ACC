import type { TeamStandingRow } from '@acc/types';
import { formatSignedNetRunRate } from '@acc/types';
import { ScrollView, View } from 'react-native';

import { TeamAvatar } from '../ui/TeamAvatar';
import { Text } from '../ui/Text';

export const STANDINGS_STAT_COLUMNS = ['M', 'W', 'L', 'NR'] as const;
export const STANDINGS_STAT_COL_WIDTH = 26;
export const STANDINGS_PTS_COL_WIDTH = 34;
export const STANDINGS_NRR_COL_WIDTH = 56;

export function standingsStatsMinWidth(showNetRunRate: boolean): number {
  return (
    STANDINGS_STAT_COLUMNS.length * STANDINGS_STAT_COL_WIDTH +
    STANDINGS_PTS_COL_WIDTH +
    (showNetRunRate ? STANDINGS_NRR_COL_WIDTH : 0)
  );
}

/** @deprecated Prefer {@link standingsStatsMinWidth} — kept for callers that always show NRR. */
export const STANDINGS_STATS_MIN_WIDTH = standingsStatsMinWidth(true);

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

/**
 * Column sizing:
 * - With NRR (tennis): fixed pixel widths inside a horizontal ScrollView.
 * - Without NRR (Leather): five columns flex evenly to fill the row — no dead gap.
 */
function statColumnStyle(stretch: boolean): { flex: number } | { width: number } {
  return stretch ? { flex: 1 } : { width: STANDINGS_STAT_COL_WIDTH };
}

function ptsColumnStyle(stretch: boolean): { flex: number } | { width: number } {
  return stretch ? { flex: 1 } : { width: STANDINGS_PTS_COL_WIDTH };
}

function StandingsStatsHeaderCells({
  showNetRunRate,
}: {
  showNetRunRate: boolean;
}): React.ReactElement {
  const stretch = !showNetRunRate;
  return (
    <View
      className="flex-row items-center pr-3"
      style={stretch ? undefined : { minWidth: standingsStatsMinWidth(showNetRunRate) }}
    >
      {STANDINGS_STAT_COLUMNS.map((column) => (
        <Text
          key={column}
          className={`text-center font-sans-medium text-[9px] uppercase tracking-wider ${headerClass(column)}`}
          style={statColumnStyle(stretch)}
        >
          {column}
        </Text>
      ))}
      {stretch ? (
        <View className="items-center" style={ptsColumnStyle(stretch)}>
          <View className="rounded-control bg-primary-container px-2 py-1">
            <Text
              className={`text-center text-[9px] uppercase tracking-wider ${headerClass('PTS')}`}
            >
              PTS
            </Text>
          </View>
        </View>
      ) : (
        <View
          className="rounded-l-control bg-primary-container px-1 py-1"
          style={ptsColumnStyle(stretch)}
        >
          <Text
            className={`text-center text-[9px] uppercase tracking-wider ${headerClass('PTS')}`}
          >
            PTS
          </Text>
        </View>
      )}
      {showNetRunRate ? (
        <Text
          className={`text-right font-sans-medium text-[9px] uppercase tracking-wider ${headerClass('NRR')}`}
          style={{ width: STANDINGS_NRR_COL_WIDTH }}
        >
          NRR
        </Text>
      ) : null}
    </View>
  );
}

export function StandingsStatsHeaderRow({
  height = PT_HEADER_HEIGHT,
  showNetRunRate = true,
}: {
  height?: number;
  showNetRunRate?: boolean;
}): React.ReactElement {
  return (
    <View
      className="justify-center border-b border-separator bg-surface-container-low"
      style={{ height }}
    >
      <StandingsStatsHeaderCells showNetRunRate={showNetRunRate} />
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
  showNetRunRate = true,
}: {
  teams: TeamStandingRow[];
  groupLabelByTeamId?: Record<string, string>;
  /** Leather points tables omit NRR. */
  showNetRunRate?: boolean;
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

      {showNetRunRate ? (
        <ScrollView
          horizontal
          bounces={false}
          showsHorizontalScrollIndicator={false}
          className="flex-1"
        >
          <View>
            <StandingsStatsHeaderRow showNetRunRate />
            {teams.map((row, index) => (
              <StandingsStatsDataRow
                key={row.teamId}
                row={row}
                showBottomDivider={index < lastIndex}
                height={rowHeight}
                showNetRunRate
              />
            ))}
          </View>
        </ScrollView>
      ) : (
        // Without NRR everything fits on-screen: flex the stat columns evenly
        // across the remaining width instead of horizontal scrolling.
        <View className="flex-1">
          <StandingsStatsHeaderRow showNetRunRate={false} />
          {teams.map((row, index) => (
            <StandingsStatsDataRow
              key={row.teamId}
              row={row}
              showBottomDivider={index < lastIndex}
              height={rowHeight}
              showNetRunRate={false}
            />
          ))}
        </View>
      )}
    </View>
  );
}

export function StandingsStatsDataRow({
  row,
  showBottomDivider = true,
  height,
  showNetRunRate = true,
}: {
  row: TeamStandingRow;
  showBottomDivider?: boolean;
  /** When set, row uses this exact height (Points Table split layout). */
  height?: number;
  showNetRunRate?: boolean;
}): React.ReactElement {
  const stretch = !showNetRunRate;
  return (
    <View
      className={`flex-row items-center pr-3 ${showBottomDivider ? 'border-b border-separator' : ''}`}
      style={{
        ...(stretch ? {} : { minWidth: standingsStatsMinWidth(showNetRunRate) }),
        ...(height != null ? { height } : {}),
      }}
    >
      {STANDINGS_STAT_COLUMNS.map((column) => (
        <Text
          key={column}
          className={`text-center font-sans text-xs ${dataClass(column)}`}
          style={statColumnStyle(stretch)}
        >
          {statValue(row, column)}
        </Text>
      ))}
      {stretch ? (
        <View className="items-center" style={ptsColumnStyle(stretch)}>
          <View
            className="justify-center rounded-control bg-primary-container px-2 py-1.5"
            style={{ minWidth: STANDINGS_PTS_COL_WIDTH }}
          >
            <Text className={`text-center text-xs ${dataClass('PTS')}`}>{row.points}</Text>
          </View>
        </View>
      ) : (
        <View
          className="justify-center rounded-l-control bg-primary-container px-1 py-1.5"
          style={ptsColumnStyle(stretch)}
        >
          <Text className={`text-center text-xs ${dataClass('PTS')}`}>{row.points}</Text>
        </View>
      )}
      {showNetRunRate ? (
        <Text
          className={`text-right font-sans text-xs ${dataClass('NRR')}`}
          style={{ width: STANDINGS_NRR_COL_WIDTH }}
        >
          {formatSignedNetRunRate(row.netRunRate)}
        </Text>
      ) : null}
    </View>
  );
}
