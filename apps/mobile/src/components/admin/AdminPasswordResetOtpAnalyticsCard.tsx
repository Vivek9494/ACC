import type { AdminPasswordResetOtpDailySeries } from '@acc/types';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  View,
} from 'react-native';

import { getAdminPasswordResetOtpDaily } from '../../lib/api';
import { logFetchError } from '../../lib/fetch-error';
import { Card } from '../ui/Card';
import { Select } from '../ui/Select';
import { FIELD_ORANGE } from '../ui/fieldStyles';
import { Text } from '../ui/Text';
import { formatPasswordResetOtpDayLabel } from './password-reset-otp-display';

const BAR_MAX_HEIGHT = 120;
/** Fixed bar column width when the chart scrolls (15/30/month). */
const SCROLL_BAR_COLUMN_WIDTH = 40;

type RangePreset = '7' | '15' | '30' | 'month';

const RANGE_OPTIONS: { value: RangePreset; label: string }[] = [
  { value: '7', label: 'Last 7 days' },
  { value: '15', label: 'Last 15 days' },
  { value: '30', label: 'Last 30 days' },
  { value: 'month', label: 'Month' },
];

const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function utcTodayParts(): { year: number; month: number; day: number } {
  const now = new Date();
  return {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth(),
    day: now.getUTCDate(),
  };
}

function formatUtcYmd(year: number, monthIndex: number, day: number): string {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

/** Inclusive UTC window ending today, spanning `dayCount` days. */
export function defaultPasswordResetOtpRange(dayCount = 7): {
  fromDate: string;
  toDate: string;
} {
  const { year, month, day } = utcTodayParts();
  const to = new Date(Date.UTC(year, month, day));
  const from = new Date(Date.UTC(year, month, day));
  from.setUTCDate(from.getUTCDate() - (dayCount - 1));
  return {
    fromDate: from.toISOString().slice(0, 10),
    toDate: to.toISOString().slice(0, 10),
  };
}

/** First/last UTC day of a calendar month (`monthIndex` 0–11). */
export function utcMonthDateRange(
  year: number,
  monthIndex: number,
): { fromDate: string; toDate: string } {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return {
    fromDate: formatUtcYmd(year, monthIndex, 1),
    toDate: formatUtcYmd(year, monthIndex, lastDay),
  };
}

/** Completed months in the current UTC year (excludes the ongoing month). */
export function completedMonthOptionsInCurrentUtcYear(): {
  value: string;
  label: string;
}[] {
  const { year, month } = utcTodayParts();
  const options: { value: string; label: string }[] = [];
  for (let m = 0; m < month; m += 1) {
    options.push({
      value: String(m),
      label: `${MONTH_LABELS[m]!} ${year}`,
    });
  }
  return options;
}

function resolveRange(
  preset: RangePreset,
  monthIndex: number | null,
): { fromDate: string; toDate: string } | null {
  if (preset === 'month') {
    if (monthIndex == null || monthIndex < 0 || monthIndex > 11) {
      return null;
    }
    return utcMonthDateRange(utcTodayParts().year, monthIndex);
  }
  const days = Number(preset);
  return defaultPasswordResetOtpRange(days);
}

/** Admin home: password-reset OTP sends per day (preset range + graph). */
export function AdminPasswordResetOtpAnalyticsCard(): React.ReactElement {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [preset, setPreset] = useState<RangePreset>('7');
  const [monthIndex, setMonthIndex] = useState<number | null>(null);
  const [series, setSeries] = useState<AdminPasswordResetOtpDailySeries | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);

  const monthOptions = useMemo(() => completedMonthOptionsInCurrentUtcYear(), []);

  const range = useMemo(
    () => resolveRange(preset, monthIndex),
    [preset, monthIndex],
  );

  const scrollable = preset !== '7';

  const loadSeries = useCallback((from: string, to: string) => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getAdminPasswordResetOtpDaily(from, to)
      .then((data) => {
        if (!cancelled) setSeries(data);
      })
      .catch((err: unknown) => {
        logFetchError('Failed to load password-reset OTP daily series', err);
        if (!cancelled) {
          setError("Couldn't load OTP analytics.");
          setSeries(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!range) {
      setSeries(null);
      setLoading(false);
      setError(null);
      return;
    }
    return loadSeries(range.fromDate, range.toDate);
  }, [range, loadSeries]);

  const maxCount = useMemo(() => {
    if (!series || series.days.length === 0) {
      return 1;
    }
    return Math.max(1, ...series.days.map((day) => day.count));
  }, [series]);

  const scrollToRecentEnd = useCallback(() => {
    if (!scrollable) {
      return;
    }
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: false });
    });
  }, [scrollable]);

  useEffect(() => {
    if (loading || !series || !scrollable || viewportWidth <= 0) {
      return;
    }
    scrollToRecentEnd();
  }, [loading, series, scrollable, viewportWidth, scrollToRecentEnd]);

  function onPresetChange(value: string): void {
    const next = value as RangePreset;
    setPreset(next);
    if (next === 'month') {
      const latest = monthOptions[monthOptions.length - 1];
      setMonthIndex(latest ? Number(latest.value) : null);
    } else {
      setMonthIndex(null);
    }
  }

  const chartBody =
    series && series.days.length > 0 ? (
      series.days.map((day) => {
        const height = Math.max(
          day.count > 0 ? 8 : 2,
          Math.round((day.count / maxCount) * BAR_MAX_HEIGHT),
        );
        return (
          <Pressable
            key={day.date}
            onPress={() => router.push(`/admin/password-reset-otp/${day.date}`)}
            accessibilityRole="button"
            accessibilityLabel={`${formatPasswordResetOtpDayLabel(day.date)}: ${day.count} OTPs`}
            className={`items-center gap-1 active:opacity-80 ${
              scrollable ? '' : 'min-w-0 flex-1'
            }`}
            style={scrollable ? { width: SCROLL_BAR_COLUMN_WIDTH } : undefined}
          >
            <Text className="font-sans text-[10px] text-on-surface-variant">
              {day.count > 0 ? day.count : ''}
            </Text>
            <View className="w-full rounded-t-md bg-primary/70" style={{ height }} />
            <Text className="font-sans text-[9px] text-on-surface-variant" numberOfLines={1}>
              {formatPasswordResetOtpDayLabel(day.date)}
            </Text>
          </Pressable>
        );
      })
    ) : null;

  return (
    <Card accent>
      <Text className="mb-3 font-sans-bold text-lg text-on-surface">Password-reset OTPs</Text>

      <View className="mb-3 w-full flex-row items-start gap-2">
        <Select
          value={preset}
          options={RANGE_OPTIONS}
          onChange={onPresetChange}
          containerClassName="w-1/2 max-w-[50%]"
        />
        {preset === 'month' ? (
          <Select
            label="Month"
            value={monthIndex != null ? String(monthIndex) : null}
            options={monthOptions}
            onChange={(value) => setMonthIndex(Number(value))}
            placeholder={
              monthOptions.length === 0 ? 'No completed months yet' : 'Select month'
            }
            emptyMessage="No completed months in the current year yet."
            disabled={monthOptions.length === 0}
            containerClassName="w-1/2 max-w-[50%]"
          />
        ) : null}
      </View>

      {loading ? (
        <View className="items-center py-8">
          <ActivityIndicator color={FIELD_ORANGE} />
        </View>
      ) : error ? (
        <Text className="py-4 font-sans text-sm text-secondary">{error}</Text>
      ) : preset === 'month' && monthIndex == null ? (
        <Text className="py-4 font-sans text-sm text-on-surface-variant">
          Select a completed month to view OTP sends.
        </Text>
      ) : chartBody ? (
        <View
          className="h-[148px]"
          onLayout={(event) => {
            const width = event.nativeEvent.layout.width;
            if (width > 0 && width !== viewportWidth) {
              setViewportWidth(width);
            }
          }}
        >
          {scrollable ? (
            <ScrollView
              ref={scrollRef}
              horizontal
              showsHorizontalScrollIndicator
              nestedScrollEnabled
              onContentSizeChange={scrollToRecentEnd}
            >
              <View className="h-full flex-row items-end gap-1 pr-1">{chartBody}</View>
            </ScrollView>
          ) : (
            <View className="h-full flex-row items-end gap-1">{chartBody}</View>
          )}
        </View>
      ) : (
        <Text className="py-4 font-sans text-sm text-on-surface-variant">
          No password-reset OTP data in this range yet.
        </Text>
      )}
    </Card>
  );
}
