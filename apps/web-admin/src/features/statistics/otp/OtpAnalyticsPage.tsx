import {
  formatCanadianMobileForDisplay,
  formatPasswordResetOtpDayLabel,
  PASSWORD_RESET_OTP_MAX_RANGE_DAYS,
  PASSWORD_RESET_OTP_RANGE_PRESETS,
  utcTodayIsoDate,
  validatePasswordResetOtpRange,
  type PasswordResetOtpDateRange,
} from '@acc/types';
import { Activity, CalendarDays, ChevronLeft, ChevronRight, KeyRound, MousePointerClick, RefreshCw, TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';

import { QueryErrorCard } from '@/components/QueryErrorCard';
import { StatCard } from '@/components/StatCard';
import { UserAvatar } from '@/components/UserAvatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';

import { OtpBarChart } from './OtpBarChart';
import {
  DEFAULT_OTP_RANGE,
  resolveOtpRange,
  selectedDayInRange,
  summarizeOtpSeries,
  type OtpRangePreset,
  type OtpRangeSelection,
} from './otp-analytics';
import { useOtpDailySeries, useOtpDayRecipients } from './otp-api';

type RangeChoice = `${OtpRangePreset}` | 'custom';

const RANGE_OPTIONS: readonly SegmentedOption<RangeChoice>[] = [
  ...PASSWORD_RESET_OTP_RANGE_PRESETS.map((days) => ({ value: `${days}` as const, label: `Last ${days} days` })),
  { value: 'custom', label: 'Custom' },
];

function presetFor(value: RangeChoice): OtpRangePreset | undefined {
  return PASSWORD_RESET_OTP_RANGE_PRESETS.find((days) => `${days}` === value);
}

function rangeLabel(range: PasswordResetOtpDateRange): string {
  return `${formatPasswordResetOtpDayLabel(range.fromDate)} – ${formatPasswordResetOtpDayLabel(range.toDate)} (UTC)`;
}

function CustomRangeForm({
  initial,
  onApply,
}: {
  initial: PasswordResetOtpDateRange;
  onApply: (range: PasswordResetOtpDateRange) => void;
}): React.ReactElement {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const today = utcTodayIsoDate();

  return (
    // `contents` lets the fields join the parent toolbar row; the helper text is pushed onto its own line.
    <form
      className="contents"
      onSubmit={(e) => {
        e.preventDefault();
        const problem = validatePasswordResetOtpRange(draft);
        setError(problem);
        if (!problem) onApply(draft);
      }}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="otp-from">From</Label>
          <Input
            id="otp-from"
            type="date"
            max={today}
            value={draft.fromDate}
            onChange={(e) => setDraft((d) => ({ ...d, fromDate: e.target.value }))}
            className="w-[150px]"
            aria-invalid={error !== null}
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="otp-to">To</Label>
          <Input
            id="otp-to"
            type="date"
            max={today}
            value={draft.toDate}
            onChange={(e) => setDraft((d) => ({ ...d, toDate: e.target.value }))}
            className="w-[150px]"
            aria-invalid={error !== null}
          />
        </div>
        <Button type="submit" variant="secondary">
          Apply
        </Button>
      </div>
      <p className={`order-last basis-full ${error ? 'text-sm text-destructive' : 'text-xs text-muted-foreground'}`}>
        {error ?? `UTC calendar days, up to ${PASSWORD_RESET_OTP_MAX_RANGE_DAYS} days.`}
      </p>
    </form>
  );
}

function RecipientsPanel({
  date,
  range,
  onStep,
}: {
  date: string | null;
  range: PasswordResetOtpDateRange;
  onStep: (direction: -1 | 1) => void;
}): React.ReactElement {
  const query = useOtpDayRecipients(date);
  const users = query.data?.users ?? [];
  const totalSends = users.reduce((sum, u) => sum + u.count, 0);

  return (
    <Card className="gap-4 lg:sticky lg:top-6">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="grid gap-1.5">
          <CardTitle className="text-secondary">
            {date ? `Recipients · ${formatPasswordResetOtpDayLabel(date)}` : 'Recipients'}
          </CardTitle>
          <CardDescription>
            {date
              ? query.isSuccess
                ? `${users.length} user${users.length === 1 ? '' : 's'} · ${totalSends} OTP${totalSends === 1 ? '' : 's'} (UTC day)`
                : 'Loading…'
              : 'Select a day on the chart'}
          </CardDescription>
        </div>
        {date ? (
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              aria-label="Previous day"
              disabled={date <= range.fromDate}
              onClick={() => onStep(-1)}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              aria-label="Next day"
              disabled={date >= range.toDate}
              onClick={() => onStep(1)}
            >
              <ChevronRight />
            </Button>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="max-h-[480px] overflow-y-auto px-0">
        {!date ? (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center text-sm text-muted-foreground">
            <MousePointerClick className="size-6 text-primary" />
            Click a bar to see who requested password-reset codes that day.
          </div>
        ) : query.isError ? (
          <p className="px-6 py-8 text-sm text-destructive">{query.error.message}</p>
        ) : query.isPending ? (
          <ul className="divide-y">
            {Array.from({ length: 4 }, (_, i) => (
              <li key={i} className="flex items-center gap-3 px-6 py-3">
                <div className="size-9 animate-pulse rounded-full bg-muted" />
                <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
              </li>
            ))}
          </ul>
        ) : users.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-muted-foreground">No OTPs were sent on this day.</p>
        ) : (
          <ul className="divide-y" aria-label="OTP recipients">
            {users.map((user) => (
              <li key={user.userId} className="flex items-center gap-3 px-6 py-3">
                <UserAvatar person={user} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground tabular-nums">
                    {formatCanadianMobileForDisplay(user.mobileNumber)}
                  </p>
                </div>
                <Badge variant={user.count > 2 ? 'live' : 'muted'} className="tabular-nums" title="OTPs sent">
                  {user.count}×
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Admin: password-reset OTP sends per UTC day with a recipients drill-down. */
export function OtpAnalyticsPage(): React.ReactElement {
  const [selection, setSelection] = useState<OtpRangeSelection>(DEFAULT_OTP_RANGE);
  const [choice, setChoice] = useState<RangeChoice>('7');
  const [pickedDate, setPickedDate] = useState<string | null>(null);

  const range = useMemo(() => resolveOtpRange(selection), [selection]);
  const query = useOtpDailySeries(range);
  const days = useMemo(() => query.data?.days ?? [], [query.data]);
  const summary = useMemo(() => summarizeOtpSeries(days), [days]);
  const selectedDate = selectedDayInRange(pickedDate, range);
  const stat = (value: number | string): number | string => (query.isPending ? '—' : value);

  const onChoice = (next: RangeChoice) => {
    setChoice(next);
    const days = presetFor(next);
    if (days) setSelection({ kind: 'preset', days });
  };

  const stepDay = (direction: -1 | 1) => {
    const index = days.findIndex((d) => d.date === selectedDate);
    const next = days[index + direction];
    if (next) setPickedDate(next.date);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <SegmentedControl ariaLabel="Date range" value={choice} options={RANGE_OPTIONS} onChange={onChoice} />
        {choice === 'custom' ? (
          <CustomRangeForm initial={range} onApply={(r) => setSelection({ kind: 'custom', range: r })} />
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="OTPs sent" value={stat(summary.total)} icon={KeyRound} accent="bg-primary/15 text-primary" />
        <StatCard
          label="Peak day"
          value={stat(summary.peak ? summary.peak.count : 0)}
          hint={summary.peak ? formatPasswordResetOtpDayLabel(summary.peak.date) : 'No sends in range'}
          icon={TrendingUp}
          accent="bg-secondary/10 text-secondary"
        />
        <StatCard
          label="Days with sends"
          value={stat(`${summary.activeDays} / ${days.length}`)}
          icon={CalendarDays}
          accent="bg-secondary/10 text-secondary"
        />
        <StatCard label="Avg per day" value={stat(summary.averagePerDay)} icon={Activity} accent="bg-muted text-muted-foreground" />
      </div>

      {query.isError ? (
        <QueryErrorCard title="Couldn't load OTP analytics" error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <Card className="gap-4">
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <div className="grid gap-1.5">
                <CardTitle className="text-secondary">Password-reset OTPs per day</CardTitle>
                <CardDescription>{rangeLabel(range)}</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => void query.refetch()} disabled={query.isFetching}>
                <RefreshCw className={query.isFetching ? 'animate-spin' : undefined} />
                Refresh
              </Button>
            </CardHeader>
            <CardContent className={query.isFetching && !query.isPending ? 'opacity-60 transition-opacity' : undefined}>
              {query.isPending ? (
                <div className="h-[320px] animate-pulse rounded-md bg-muted" />
              ) : (
                <OtpBarChart days={days} selectedDate={selectedDate} onSelectDate={setPickedDate} />
              )}
            </CardContent>
          </Card>
          <RecipientsPanel date={selectedDate} range={range} onStep={stepDay} />
        </div>
      )}
    </div>
  );
}
