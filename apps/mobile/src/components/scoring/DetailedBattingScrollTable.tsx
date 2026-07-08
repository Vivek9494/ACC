import {
  formatBatterStrikeRateDisplay,
  type BatterCard,
} from '@acc/types';
import { useCallback, useMemo, useState } from 'react';
import {
  ScrollView,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { SCORECARD_BATTING_TABLE_METRICS } from './liveScoringScorecardTypography';
import { Text } from '../ui/Text';

const METRICS = SCORECARD_BATTING_TABLE_METRICS;

const CORE_COLUMN_KEYS = ['R', 'B', '4s', '6s', 'SR'] as const;
const SCROLL_COLUMN_KEYS = ['1s', '2s', '3s'] as const;

interface StatColumn {
  key: string;
  label: string;
  width: number;
  value: (card: BatterCard) => string;
}

interface DetailedBattingRow {
  id: string;
  name: string;
  statusLine: string;
  card: BatterCard;
  highlightName: boolean;
}

function buildStatColumns(): StatColumn[] {
  const standard = METRICS.statWidth;
  return [
    { key: 'R', label: 'R', width: standard, value: (card) => String(card.runs) },
    { key: 'B', label: 'B', width: standard, value: (card) => String(card.balls) },
    { key: '1s', label: '1s', width: standard, value: (card) => String(card.ones) },
    { key: '2s', label: '2s', width: standard, value: (card) => String(card.twos) },
    { key: '3s', label: '3s', width: standard, value: (card) => String(card.threes) },
    { key: '4s', label: '4s', width: standard, value: (card) => String(card.fours) },
    { key: '6s', label: '6s', width: standard, value: (card) => String(card.sixes) },
    {
      key: 'SR',
      label: 'SR',
      width: METRICS.srWidth,
      value: (card) => formatBatterStrikeRateDisplay(card),
    },
  ];
}

function statTableWidth(columns: StatColumn[]): number {
  return columns.reduce((sum, column) => sum + column.width, 0);
}

export interface DetailedBattingScrollTableProps {
  rows: DetailedBattingRow[];
}

/** Scorecard batting table — pinned batsman + default R/B/4s/6s/SR; 1s/2s/3s via horizontal scroll. */
export function DetailedBattingScrollTable({
  rows,
}: DetailedBattingScrollTableProps): React.ReactElement {
  const statColumns = useMemo(() => buildStatColumns(), []);
  const coreColumns = useMemo(
    () =>
      statColumns.filter((column) => (CORE_COLUMN_KEYS as readonly string[]).includes(column.key)),
    [statColumns],
  );
  const scrollColumns = useMemo(
    () =>
      statColumns.filter((column) =>
        (SCROLL_COLUMN_KEYS as readonly string[]).includes(column.key),
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
            height: METRICS.headerHeight,
            width: METRICS.pinnedColWidth,
          }}
        >
          <Text className={METRICS.pinnedHeaderClass}>Batsman</Text>
        </View>
        {rows.map((row, index) => (
          <View
            key={row.id}
            className={`justify-center px-1 ${index < lastIndex ? 'border-b border-outline-variant/30' : ''}`}
            style={{ height: METRICS.rowHeight, width: METRICS.pinnedColWidth }}
          >
            <Text
              className={`${METRICS.nameClass} ${
                row.highlightName ? 'text-primary' : 'text-on-surface'
              }`}
              numberOfLines={1}
            >
              {row.name}
            </Text>
            {row.statusLine ? (
              <Text
                className={`mt-0.5 ${METRICS.statusClass} ${
                  row.highlightName ? 'text-primary' : 'text-on-surface-variant'
                }`}
                numberOfLines={1}
              >
                {row.statusLine}
              </Text>
            ) : null}
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
                className="flex-row border-b border-outline-variant/30"
                style={{
                  height: METRICS.headerHeight,
                  width: statsViewportWidth + scrollContentWidth,
                }}
              >
                <View style={{ width: statsViewportWidth }} className="flex-row">
                  {coreColumns.map((column) => (
                    <View key={column.key} className="flex-1 items-center justify-center px-0.5">
                      <Text className={METRICS.columnHeaderClass}>{column.label}</Text>
                    </View>
                  ))}
                </View>
                <View style={{ width: scrollContentWidth }} className="flex-row">
                  {scrollColumns.map((column) => (
                    <View
                      key={column.key}
                      className="items-center justify-center px-0.5"
                      style={{ width: column.width }}
                    >
                      <Text className={METRICS.columnHeaderClass}>{column.label}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {rows.map((row, index) => (
                <View
                  key={row.id}
                  className={`flex-row items-center ${index < lastIndex ? 'border-b border-outline-variant/30' : ''}`}
                  style={{
                    height: METRICS.rowHeight,
                    width: statsViewportWidth + scrollContentWidth,
                  }}
                >
                  <View style={{ width: statsViewportWidth }} className="flex-row">
                    {coreColumns.map((column) => (
                      <View key={column.key} className="flex-1 items-center justify-center px-0.5">
                        <Text
                          className={`${METRICS.valueClass} ${
                            row.highlightName ? 'text-primary' : 'text-on-surface'
                          }`}
                        >
                          {column.value(row.card)}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <View style={{ width: scrollContentWidth }} className="flex-row items-center">
                    {scrollColumns.map((column) => (
                      <View
                        key={column.key}
                        className="items-center justify-center px-0.5"
                        style={{ width: column.width }}
                      >
                        <Text
                          className={`${METRICS.valueClass} ${
                            row.highlightName ? 'text-primary' : 'text-on-surface'
                          }`}
                        >
                          {column.value(row.card)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        ) : (
          <View
            style={{
              height: METRICS.headerHeight + METRICS.rowHeight * rows.length,
            }}
          />
        )}
      </View>
    </View>
  );
}
