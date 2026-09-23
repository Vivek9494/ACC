import type {
  AdminPasswordResetOtpDailySeries,
  AdminPasswordResetOtpDayUser,
} from '@acc/types';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import {
  getAdminPasswordResetOtpByDay,
  getAdminPasswordResetOtpDaily,
} from '../../lib/api';
import { logFetchError } from '../../lib/fetch-error';
import { PlayerAvatar } from '../tournament/PlayerAvatar';
import { Card } from '../ui/Card';
import { DateField } from '../ui/DateField';
import { FIELD_ORANGE } from '../ui/fieldStyles';
import { Text } from '../ui/Text';

const BAR_MAX_HEIGHT = 120;

function utcTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Inclusive UTC window ending today, spanning `dayCount` days. */
export function defaultPasswordResetOtpRange(dayCount = 7): {
  fromDate: string;
  toDate: string;
} {
  const to = new Date();
  const from = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  from.setUTCDate(from.getUTCDate() - (dayCount - 1));
  return {
    fromDate: from.toISOString().slice(0, 10),
    toDate: to.toISOString().slice(0, 10),
  };
}

function formatBarLabel(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) {
    return isoDate;
  }
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function DayUserRow({ user }: { user: AdminPasswordResetOtpDayUser }): React.ReactElement {
  return (
    <View className="flex-row items-center gap-3 py-2">
      <PlayerAvatar
        firstName={user.firstName}
        profilePhotoUrl={user.profilePhotoUrl}
        size="sm"
      />
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="font-sans-semibold text-base text-on-surface" numberOfLines={1}>
          {user.firstName} {user.lastName}
        </Text>
        <Text className="font-sans text-sm text-on-surface-variant" numberOfLines={1}>
          {user.mobileNumber}
        </Text>
      </View>
      <Text className="font-sans-bold text-base text-primary">{user.count}</Text>
    </View>
  );
}

/** Admin home: password-reset OTP sends per day + drill-down list. */
export function AdminPasswordResetOtpAnalyticsCard(): React.ReactElement {
  const initial = useMemo(() => defaultPasswordResetOtpRange(7), []);
  const [fromDate, setFromDate] = useState(initial.fromDate);
  const [toDate, setToDate] = useState(initial.toDate);
  const [series, setSeries] = useState<AdminPasswordResetOtpDailySeries | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayUsers, setDayUsers] = useState<AdminPasswordResetOtpDayUser[]>([]);
  const [dayLoading, setDayLoading] = useState(false);
  const [dayError, setDayError] = useState<string | null>(null);

  const loadSeries = useCallback((from: string, to: string) => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getAdminPasswordResetOtpDaily(from, to)
      .then((data) => {
        if (cancelled) return;
        setSeries(data);
        setSelectedDate((current) => {
          if (current && data.days.some((day) => day.date === current)) {
            return current;
          }
          const withSends = [...data.days].reverse().find((day) => day.count > 0);
          return withSends?.date ?? data.days[data.days.length - 1]?.date ?? null;
        });
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

  useEffect(() => loadSeries(fromDate, toDate), [fromDate, toDate, loadSeries]);

  useEffect(() => {
    if (!selectedDate) {
      setDayUsers([]);
      setDayError(null);
      return;
    }
    let cancelled = false;
    setDayLoading(true);
    setDayError(null);
    getAdminPasswordResetOtpByDay(selectedDate)
      .then((data) => {
        if (!cancelled) setDayUsers(data.users);
      })
      .catch((err: unknown) => {
        logFetchError('Failed to load password-reset OTP day users', err);
        if (!cancelled) {
          setDayError("Couldn't load users for this day.");
          setDayUsers([]);
        }
      })
      .finally(() => {
        if (!cancelled) setDayLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  const maxCount = useMemo(() => {
    if (!series || series.days.length === 0) {
      return 1;
    }
    return Math.max(1, ...series.days.map((day) => day.count));
  }, [series]);

  const fromMinimum = useMemo(() => {
    const today = new Date();
    return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 89));
  }, []);

  const todayLocalForPicker = useMemo(() => {
    const iso = utcTodayIso();
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y!, m! - 1, d!);
  }, []);

  return (
    <Card accent>
      <Text className="mb-1 font-sans-bold text-lg text-on-surface">Password-reset OTPs</Text>
      <Text className="mb-4 font-sans text-sm text-on-surface-variant">
        SMS codes sent per day (UTC). Data starts when logging began — earlier days stay empty.
      </Text>

      <View className="mb-4 w-full flex-row items-start gap-3">
        <DateField
          label="From"
          value={fromDate}
          onChange={(next) => {
            setFromDate(next);
            if (next > toDate) {
              setToDate(next);
            }
          }}
          enforceSignupAgeMax={false}
          minimumDate={fromMinimum}
          maximumDate={todayLocalForPicker}
          compactDisplay
          containerClassName="min-w-0 flex-1"
        />
        <DateField
          label="To"
          value={toDate}
          onChange={(next) => {
            setToDate(next);
            if (next < fromDate) {
              setFromDate(next);
            }
          }}
          enforceSignupAgeMax={false}
          minimumDate={fromMinimum}
          maximumDate={todayLocalForPicker}
          compactDisplay
          containerClassName="min-w-0 flex-1"
        />
      </View>

      {loading ? (
        <View className="items-center py-8">
          <ActivityIndicator color={FIELD_ORANGE} />
        </View>
      ) : error ? (
        <Text className="py-4 font-sans text-sm text-secondary">{error}</Text>
      ) : series && series.days.length > 0 ? (
        <View className="gap-3">
          <View className="h-[148px] flex-row items-end gap-1">
            {series.days.map((day) => {
              const height = Math.max(
                day.count > 0 ? 8 : 2,
                Math.round((day.count / maxCount) * BAR_MAX_HEIGHT),
              );
              const selected = day.date === selectedDate;
              return (
                <Pressable
                  key={day.date}
                  onPress={() => setSelectedDate(day.date)}
                  accessibilityRole="button"
                  accessibilityLabel={`${formatBarLabel(day.date)}: ${day.count} OTPs`}
                  className="min-w-0 flex-1 items-center gap-1 active:opacity-80"
                >
                  <Text className="font-sans text-[10px] text-on-surface-variant">
                    {day.count > 0 ? day.count : ''}
                  </Text>
                  <View
                    className={`w-full rounded-t-md ${selected ? 'bg-primary' : 'bg-primary/40'}`}
                    style={{ height }}
                  />
                  <Text
                    className={`font-sans text-[9px] ${
                      selected ? 'font-sans-semibold text-primary' : 'text-on-surface-variant'
                    }`}
                    numberOfLines={1}
                  >
                    {formatBarLabel(day.date)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {selectedDate ? (
            <View className="mt-2 gap-2 border-t border-outline-variant pt-3">
              <Text className="font-sans-bold text-base text-on-surface">
                {formatBarLabel(selectedDate)} · OTP recipients
              </Text>
              {dayLoading ? (
                <ActivityIndicator color={FIELD_ORANGE} />
              ) : dayError ? (
                <Text className="font-sans text-sm text-secondary">{dayError}</Text>
              ) : dayUsers.length === 0 ? (
                <Text className="font-sans text-sm text-on-surface-variant">
                  No password-reset OTPs sent this day.
                </Text>
              ) : (
                dayUsers.map((user) => <DayUserRow key={user.userId} user={user} />)
              )}
            </View>
          ) : null}
        </View>
      ) : (
        <Text className="py-4 font-sans text-sm text-on-surface-variant">
          No password-reset OTP data in this range yet.
        </Text>
      )}
    </Card>
  );
}

