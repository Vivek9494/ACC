import type {
  AdminPasswordResetOtpDailySeries,
  AdminPasswordResetOtpDayUsers,
  PasswordResetOtpDateRange,
} from '@acc/types';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api-client';

export const otpAnalyticsKeys = {
  all: ['admin-otp'] as const,
  daily: (range: PasswordResetOtpDateRange) => ['admin-otp', 'daily', range.fromDate, range.toDate] as const,
  day: (date: string) => ['admin-otp', 'day', date] as const,
};

/** GET /admin/password-reset-otp/daily — Admin only (VIEW_ADMIN_OVERVIEW). */
export function useOtpDailySeries(range: PasswordResetOtpDateRange, enabled = true) {
  return useQuery({
    queryKey: otpAnalyticsKeys.daily(range),
    queryFn: ({ signal }) =>
      apiFetch<AdminPasswordResetOtpDailySeries>(
        `/admin/password-reset-otp/daily?${new URLSearchParams({ fromDate: range.fromDate, toDate: range.toDate })}`,
        { signal },
      ),
    enabled,
    placeholderData: keepPreviousData,
  });
}

/** GET /admin/password-reset-otp/by-day — recipients for one UTC day. */
export function useOtpDayRecipients(date: string | null) {
  return useQuery({
    queryKey: otpAnalyticsKeys.day(date ?? ''),
    queryFn: ({ signal }) =>
      apiFetch<AdminPasswordResetOtpDayUsers>(
        `/admin/password-reset-otp/by-day?${new URLSearchParams({ date: date ?? '' })}`,
        { signal },
      ),
    enabled: date !== null,
  });
}
