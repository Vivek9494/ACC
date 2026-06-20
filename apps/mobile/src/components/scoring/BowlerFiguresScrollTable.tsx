import { formatBowlerEconomyDisplay, type BowlerCard } from '@acc/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import {
  SCORECARD_BOWLING_BOUNDARY_STAT_WIDTH,
  SCORECARD_BOWLING_RATE_STAT_WIDTH,
  SCORECARD_BOWLING_STANDARD_STAT_WIDTH,
  SCORECARD_NAME_COLUMN_GAP,
} from '../scorecardTableWidths';
import { Text } from '../ui/Text';

/** Live scoring Bowling card — compact fixed widths. */
const LIVE_NAME_COLUMN_WIDTH = 88;
const LIVE_STANDARD_STAT_WIDTH = 48;
const LIVE_RATE_STAT_WIDTH = 52;

interface StatColumn {
  key: string;
  label: string;
  emphasize?: boolean;
  width: number;
  value: (card: BowlerCard) => string;
}

interface ColumnWidths {
  standard: number;
  boundary: number;
  rate: number;
}

function buildStatColumns(widths: ColumnWidths): StatColumn[] {
  const { standard, boundary, rate } = widths;
  return [
    { key: 'O', label: 'O', width: standard, value: (card) => card.oversText },
    { key: 'M', label: 'M', width: standard, value: (card) => String(card.maidens) },
    { key: 'R', label: 'R', width: standard, value: (card) => String(card.runsConceded) },
    {
      key: 'W',
      label: 'W',
      width: standard,
      emphasize: true,
      value: (card) => String(card.wickets),
    },
    {
      key: 'Eco',
      label: 'Eco',
      width: rate,
      value: (card) => formatBowlerEconomyDisplay(card),
    },
    { key: '0s', label: '0s', width: standard, value: (card) => String(card.dotBalls) },
    { key: 'Wd', label: 'Wd', width: standard, value: (card) => String(card.wides) },
    { key: 'NB', label: 'NB', width: standard, value: (card) => String(card.noBalls) },
    { key: '4s', label: '4s', width: boundary, value: (card) => String(card.fours) },
    { key: '6s', label: '6s', width: boundary, value: (card) => String(card.sixes) },
  ];
}

const LIVE_STAT_COLUMNS = buildStatColumns({
  standard: LIVE_STANDARD_STAT_WIDTH,
  boundary: LIVE_STANDARD_STAT_WIDTH,
  rate: LIVE_RATE_STAT_WIDTH,
});

const SCORECARD_STAT_COLUMNS = buildStatColumns({
  standard: SCORECARD_BOWLING_STANDARD_STAT_WIDTH,
  boundary: SCORECARD_BOWLING_BOUNDARY_STAT_WIDTH,
  rate: SCORECARD_BOWLING_RATE_STAT_WIDTH,
});

const STATS_PANE_STYLE = { flex: 1, minWidth: 0, overflow: 'hidden' as const };
const STATS_SCROLL_STYLE = { width: '100%' as const };
const SCORECARD_ROW_PY = 8;

export interface BowlerFiguresRow {
  id: string;
  name: string;
  card: BowlerCard;
  highlightName?: boolean;
  nameSuffix?: string;
}

export interface BowlerFiguresScrollTableProps {
  rows: BowlerFiguresRow[];
  /** Tighter chrome for the live scoring Bowling card. */
  compact?: boolean;
  /**
   * Innings scorecard: frozen name width matching the Batting card name column
   * (from {@link scorecardPlayerNameColumnWidth}).
   */
  scorecardNameColumnWidth?: number;
}

function StatHeaderCell({ column }: { column: StatColumn }): React.ReactElement {
  return (
    <Text
      style={{ width: column.width }}
      className={`shrink-0 text-right font-sans-semibold text-[10px] uppercase tracking-wide ${
        column.emphasize ? 'text-primary' : 'text-on-surface-variant'
      }`}
    >
      {column.label}
    </Text>
  );
}

function StatValueCell({
  column,
  card,
  scorecard,
  highlightRow,
}: {
  column: StatColumn;
  card: BowlerCard;
  scorecard: boolean;
  highlightRow: boolean;
}): React.ReactElement {
  const figureClass = scorecard
    ? highlightRow
      ? 'font-sans-semibold text-xs text-primary'
      : 'font-sans text-xs text-on-surface'
    : column.emphasize
      ? 'font-sans-bold text-sm text-primary'
      : 'font-sans text-sm text-on-surface';

  return (
    <Text style={{ width: column.width }} numberOfLines={1} className={`shrink-0 text-right ${figureClass}`}>
      {column.value(card)}
    </Text>
  );
}

/**
 * Frozen bowler name + horizontally scrollable figures (O…Eco default; 0s…6s on scroll).
 * Shared by the live scoring Bowling card and the innings scorecard Bowling section.
 */
export function BowlerFiguresScrollTable({
  rows,
  compact = false,
  scorecardNameColumnWidth,
}: BowlerFiguresScrollTableProps): React.ReactElement {
  const scorecard = scorecardNameColumnWidth != null;
  const statColumns = scorecard ? SCORECARD_STAT_COLUMNS : LIVE_STAT_COLUMNS;
  const statTableWidth = useMemo(
    () => statColumns.reduce((sum, column) => sum + column.width, 0),
    [statColumns],
  );
  const nameColumnWidth = scorecard ? scorecardNameColumnWidth : LIVE_NAME_COLUMN_WIDTH;
  const nameColumnGap = scorecard ? SCORECARD_NAME_COLUMN_GAP : 8;

  const bodyScrollRef = useRef<ScrollView>(null);
  const headerScrollRef = useRef<ScrollView>(null);
  const syncingScroll = useRef(false);
  const [rowHeights, setRowHeights] = useState<Record<number, number>>({});

  useEffect(() => {
    setRowHeights({});
  }, [rows, nameColumnWidth]);

  const onStatsRowLayout = useCallback((index: number, event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    setRowHeights((prev) => (prev[index] === height ? prev : { ...prev, [index]: height }));
  }, []);

  const syncHeaderToBody = useCallback((x: number) => {
    if (syncingScroll.current) {
      return;
    }
    syncingScroll.current = true;
    headerScrollRef.current?.scrollTo({ x, animated: false });
    syncingScroll.current = false;
  }, []);

  const onBodyScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      syncHeaderToBody(event.nativeEvent.contentOffset.x);
    },
    [syncHeaderToBody],
  );

  const borderClass = compact ? 'border-outline-variant/30' : 'border-outline-variant';
  const nameHeaderPad = compact ? 'py-1.5' : 'pb-2 pt-1';
  const rowPy = compact ? undefined : SCORECARD_ROW_PY;

  return (
    <View>
      <View className="flex-row">
        <View
          style={{ width: nameColumnWidth, paddingRight: nameColumnGap }}
          className={`border-b ${borderClass} ${nameHeaderPad}`}
        >
          <Text className="font-sans-semibold text-[10px] uppercase tracking-wide text-on-surface-variant">
            Bowler
          </Text>
        </View>
        <View style={STATS_PANE_STYLE}>
          <ScrollView
            ref={headerScrollRef}
            horizontal
            scrollEnabled={false}
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            style={STATS_SCROLL_STYLE}
          >
            <View
              style={{ width: statTableWidth }}
              className={`flex-row border-b ${borderClass} ${nameHeaderPad}`}
            >
              {statColumns.map((column) => (
                <StatHeaderCell key={column.key} column={column} />
              ))}
            </View>
          </ScrollView>
        </View>
      </View>

      <View className="flex-row">
        <View style={{ width: nameColumnWidth, paddingRight: nameColumnGap }} className="shrink-0">
          {rows.map((row, index) => {
            const measuredHeight = rowHeights[index];
            return (
              <View
                key={row.id}
                className={`justify-center border-b border-separator ${compact ? 'py-1.5' : ''}`}
                style={{
                  paddingVertical: rowPy,
                  minHeight: measuredHeight,
                }}
              >
                <Text
                  className={`font-sans-semibold text-sm ${
                    row.highlightName ? 'text-primary' : 'text-on-surface'
                  }`}
                >
                  {row.name}
                  {row.nameSuffix ?? ''}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={STATS_PANE_STYLE}>
          <ScrollView
            ref={bodyScrollRef}
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={onBodyScroll}
            style={STATS_SCROLL_STYLE}
          >
            <View style={{ width: statTableWidth }}>
              {rows.map((row, index) => (
                <View
                  key={row.id}
                  className={`flex-row items-center border-b border-separator ${compact ? 'pb-1.5' : ''}`}
                  style={{ paddingVertical: rowPy }}
                  onLayout={(event) => onStatsRowLayout(index, event)}
                >
                  {statColumns.map((column) => (
                    <StatValueCell
                      key={column.key}
                      column={column}
                      card={row.card}
                      scorecard={scorecard}
                      highlightRow={Boolean(row.highlightName)}
                    />
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </View>
  );
}
