import { formatBowlerEconomyDisplay, type BowlerCard } from '@acc/types';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, View, type LayoutChangeEvent } from 'react-native';

import {
  BOWLING_TABLE_METRICS,
  type BowlingTableDensity,
} from './liveScoringScorecardTypography';
import { Text } from '../ui/Text';

/** Live scoring Bowling card — pinned name + scrollable stats. */
export const LIVE_BOWLING_PINNED_COL_WIDTH = BOWLING_TABLE_METRICS.live.pinnedColWidth;
export const LIVE_BOWLING_SCROLL_STAT_WIDTH = BOWLING_TABLE_METRICS.live.scrollStatWidth;
export const LIVE_BOWLING_ECO_WIDTH = BOWLING_TABLE_METRICS.live.ecoWidth;
export const LIVE_BOWLING_HEADER_HEIGHT = BOWLING_TABLE_METRICS.live.headerHeight;
export const LIVE_BOWLING_ROW_HEIGHT = BOWLING_TABLE_METRICS.live.rowHeight;

const CORE_COLUMN_KEYS = ['O', 'M', 'R', 'W', 'Eco'] as const;

interface StatColumn {
  key: string;
  label: string;
  emphasize?: boolean;
  width: number;
  value: (card: BowlerCard) => string;
}

function buildStatColumns(scrollStatWidth: number, ecoWidth: number): StatColumn[] {
  return [
    { key: 'O', label: 'O', width: scrollStatWidth, value: (card) => card.oversText },
    { key: 'M', label: 'M', width: scrollStatWidth, value: (card) => String(card.maidens) },
    { key: 'R', label: 'R', width: scrollStatWidth, value: (card) => String(card.runsConceded) },
    {
      key: 'W',
      label: 'W',
      width: scrollStatWidth,
      emphasize: true,
      value: (card) => String(card.wickets),
    },
    {
      key: 'Eco',
      label: 'Eco',
      width: ecoWidth,
      value: (card) => formatBowlerEconomyDisplay(card),
    },
    { key: '0s', label: '0s', width: scrollStatWidth, value: (card) => String(card.dotBalls) },
    { key: 'Wd', label: 'Wd', width: scrollStatWidth, value: (card) => String(card.wides) },
    { key: 'NB', label: 'NB', width: scrollStatWidth, value: (card) => String(card.noBalls) },
    { key: '4s', label: '4s', width: scrollStatWidth, value: (card) => String(card.fours) },
    { key: '6s', label: '6s', width: scrollStatWidth, value: (card) => String(card.sixes) },
  ];
}

export interface BowlerFiguresRow {
  id: string;
  name: string;
  card: BowlerCard;
  highlightName?: boolean;
  nameSuffix?: string;
}

export interface BowlerFiguresScrollTableProps {
  rows: BowlerFiguresRow[];
  /** `scorecard` enlarges type for the Live Scoring Scorecard tab; default keeps Live sizing. */
  density?: BowlingTableDensity;
}

function statTableWidth(columns: StatColumn[]): number {
  return columns.reduce((sum, column) => sum + column.width, 0);
}

function BowlingPinnedSplitTable({
  rows,
  density,
}: {
  rows: BowlerFiguresRow[];
  density: BowlingTableDensity;
}): React.ReactElement {
  const metrics = BOWLING_TABLE_METRICS[density];
  const statColumns = useMemo(
    () => buildStatColumns(metrics.scrollStatWidth, metrics.ecoWidth),
    [metrics.ecoWidth, metrics.scrollStatWidth],
  );
  const coreColumns = useMemo(
    () =>
      statColumns.filter((column) => (CORE_COLUMN_KEYS as readonly string[]).includes(column.key)),
    [statColumns],
  );
  const scrollColumns = useMemo(
    () =>
      statColumns.filter(
        (column) => !(CORE_COLUMN_KEYS as readonly string[]).includes(column.key),
      ),
    [statColumns],
  );

  const [statsViewportWidth, setStatsViewportWidth] = useState(0);
  const lastIndex = rows.length - 1;
  const scrollContentWidth = statTableWidth(scrollColumns);
  const statsReady = statsViewportWidth > 0;

  const onStatsViewportLayout = useCallback((event: LayoutChangeEvent) => {
    const width = Math.floor(event.nativeEvent.layout.width);
    setStatsViewportWidth((prev) => (prev === width ? prev : width));
  }, []);

  return (
    <View className="flex-row">
      <View className="shrink-0">
        <View
          className="justify-center border-b border-outline-variant/30 px-1"
          style={{
            height: metrics.headerHeight,
            width: metrics.pinnedColWidth,
          }}
        >
          <Text className={metrics.headerLabelClass}>Bowler</Text>
        </View>
        {rows.map((row, index) => (
          <View
            key={row.id}
            className={`justify-center px-1 ${index < lastIndex ? 'border-b border-outline-variant/30' : ''}`}
            style={{ height: metrics.rowHeight, width: metrics.pinnedColWidth }}
          >
            <Text
              className={`${metrics.nameClass} ${
                row.highlightName ? 'text-primary' : 'text-on-surface'
              }`}
              numberOfLines={1}
            >
              {row.name}
              {row.nameSuffix ?? ''}
            </Text>
          </View>
        ))}
      </View>

      <View className="min-w-0 flex-1 overflow-hidden" onLayout={onStatsViewportLayout}>
        {statsReady ? (
          <ScrollView
            horizontal
            bounces={false}
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: 0, y: 0 }}
          >
            <View style={{ width: statsViewportWidth + scrollContentWidth }}>
              <View
                className="flex-row items-center border-b border-outline-variant/30"
                style={{
                  height: metrics.headerHeight,
                  width: statsViewportWidth + scrollContentWidth,
                }}
              >
                <View style={{ width: statsViewportWidth }} className="flex-row">
                  {coreColumns.map((column) => (
                    <View key={column.key} className="flex-1 justify-center px-0.5">
                      <Text
                        className={`w-full text-right ${
                          column.emphasize
                            ? metrics.headerCellEmphasisClass
                            : metrics.headerCellClass
                        }`}
                      >
                        {column.label}
                      </Text>
                    </View>
                  ))}
                </View>
                <View
                  style={{ width: scrollContentWidth }}
                  className="flex-row items-center pr-1"
                >
                  {scrollColumns.map((column) => (
                    <Text
                      key={column.key}
                      style={{ width: column.width }}
                      className={`shrink-0 text-right ${metrics.headerCellClass} text-on-surface-variant`}
                    >
                      {column.label}
                    </Text>
                  ))}
                </View>
              </View>

              {rows.map((row, index) => (
                <View
                  key={row.id}
                  className={`flex-row items-center ${index < lastIndex ? 'border-b border-outline-variant/30' : ''}`}
                  style={{
                    height: metrics.rowHeight,
                    width: statsViewportWidth + scrollContentWidth,
                  }}
                >
                  <View style={{ width: statsViewportWidth }} className="flex-row">
                    {coreColumns.map((column) => (
                      <View key={column.key} className="flex-1 justify-center px-0.5">
                        <Text
                          numberOfLines={1}
                          className={`w-full text-right ${
                            column.emphasize
                              ? metrics.valueEmphasisClass
                              : `${metrics.valueClass} ${
                                  row.highlightName ? 'text-primary' : 'text-on-surface'
                                }`
                          }`}
                        >
                          {column.value(row.card)}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <View
                    style={{ width: scrollContentWidth }}
                    className="flex-row items-center pr-1"
                  >
                    {scrollColumns.map((column) => (
                      <Text
                        key={column.key}
                        style={{ width: column.width }}
                        numberOfLines={1}
                        className={`shrink-0 text-right ${metrics.valueClass} ${
                          row.highlightName ? 'text-primary' : 'text-on-surface'
                        }`}
                      >
                        {column.value(row.card)}
                      </Text>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        ) : (
          <View
            style={{ height: metrics.headerHeight + metrics.rowHeight * rows.length }}
          />
        )}
      </View>
    </View>
  );
}

/**
 * Frozen bowler name + horizontally scrollable figures (O…Eco default; 0s…6s on scroll).
 * Shared by the Live and Scorecard bowling sections.
 */
export function BowlerFiguresScrollTable({
  rows,
  density = 'live',
}: BowlerFiguresScrollTableProps): React.ReactElement {
  return <BowlingPinnedSplitTable rows={rows} density={density} />;
}
