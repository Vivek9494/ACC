import {
  defaultPasswordResetOtpRange,
  PASSWORD_RESET_OTP_RANGE_PRESETS,
  type AdminPasswordResetOtpDayCount,
  type PasswordResetOtpDateRange,
} from '@acc/types';

export type OtpRangePreset = (typeof PASSWORD_RESET_OTP_RANGE_PRESETS)[number];

export type OtpRangeSelection =
  | { kind: 'preset'; days: OtpRangePreset }
  | { kind: 'custom'; range: PasswordResetOtpDateRange };

export const DEFAULT_OTP_RANGE: OtpRangeSelection = { kind: 'preset', days: 7 };

export function resolveOtpRange(selection: OtpRangeSelection, now: Date = new Date()): PasswordResetOtpDateRange {
  return selection.kind === 'preset' ? defaultPasswordResetOtpRange(selection.days, now) : selection.range;
}

export interface OtpSeriesSummary {
  total: number;
  /** Days in range with at least one send. */
  activeDays: number;
  averagePerDay: number;
  /** Busiest day (earliest on ties); null when nothing was sent. */
  peak: AdminPasswordResetOtpDayCount | null;
}

export function summarizeOtpSeries(days: readonly AdminPasswordResetOtpDayCount[]): OtpSeriesSummary {
  let total = 0;
  let activeDays = 0;
  let peak: AdminPasswordResetOtpDayCount | null = null;
  for (const day of days) {
    total += day.count;
    if (day.count > 0) activeDays += 1;
    if (day.count > 0 && (!peak || day.count > peak.count)) peak = day;
  }
  return {
    total,
    activeDays,
    averagePerDay: days.length === 0 ? 0 : Math.round((total / days.length) * 10) / 10,
    peak,
  };
}

/** Keeps the drill-down day only while it's inside the charted range. */
export function selectedDayInRange(selected: string | null, range: PasswordResetOtpDateRange): string | null {
  if (!selected) return null;
  return selected >= range.fromDate && selected <= range.toDate ? selected : null;
}
