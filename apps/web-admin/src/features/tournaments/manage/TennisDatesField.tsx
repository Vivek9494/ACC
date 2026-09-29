import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const pad = (n: number): string => String(n).padStart(2, '0');

export function localIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseIsoDate(value: string): Date {
  const [year = 1970, month = 1, day = 1] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

const chipFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
const monthFormatter = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });

/** Tennis: pick individual match days (same rules as mobile — no past days; days with matches can't be removed). */
export function TennisDatesField({
  id,
  value,
  onChange,
  minDate,
  lockedDates = [],
  invalid,
}: {
  id: string;
  value: readonly string[];
  onChange: (next: string[]) => void;
  minDate: string;
  lockedDates?: readonly string[];
  invalid?: boolean;
}): React.ReactElement {
  const [month, setMonth] = useState(() => {
    const anchor = parseIsoDate([...value].sort()[0] ?? minDate);
    return new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  });
  const selected = useMemo(() => new Set(value), [value]);
  const locked = useMemo(() => new Set(lockedDates), [lockedDates]);

  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const blanks: null[] = Array.from({ length: first.getDay() }, () => null);
    const days = Array.from({ length: daysInMonth }, (_, i) =>
      localIsoDate(new Date(month.getFullYear(), month.getMonth(), i + 1)),
    );
    return [...blanks, ...days];
  }, [month]);

  const toggle = (day: string) => {
    if (selected.has(day)) {
      if (locked.has(day)) return;
      onChange(value.filter((d) => d !== day));
    } else {
      onChange([...value, day].sort());
    }
  };

  const shiftMonth = (delta: number) =>
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  const sorted = [...value].sort();

  return (
    <div className="flex flex-col gap-3 @xl:flex-row @xl:items-start @xl:gap-5">
      <div
        id={id}
        className={cn(
          'w-full max-w-sm shrink-0 rounded-md border bg-card p-3 shadow-xs',
          invalid && 'border-destructive',
        )}
      >
        <div className="mb-2 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
          >
            <ChevronLeft />
          </Button>
          <p className="text-sm font-semibold" aria-live="polite">
            {monthFormatter.format(month)}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
          >
            <ChevronRight />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((day) => (
            <span key={day} className="py-1 text-xs font-medium text-muted-foreground">
              {day}
            </span>
          ))}
          {cells.map((day, index) =>
            day ? (
              <button
                key={day}
                type="button"
                onClick={() => toggle(day)}
                disabled={
                  (day < minDate && !selected.has(day)) || (selected.has(day) && locked.has(day))
                }
                aria-pressed={selected.has(day)}
                aria-label={chipFormatter.format(parseIsoDate(day))}
                className={cn(
                  'aspect-square rounded-md text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                  selected.has(day)
                    ? 'bg-primary font-semibold text-primary-foreground disabled:opacity-80'
                    : 'hover:bg-accent',
                )}
              >
                {parseIsoDate(day).getDate()}
              </button>
            ) : (
              <span key={`blank-${index}`} />
            ),
          )}
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="hidden text-xs font-medium text-muted-foreground @xl:block">
          {sorted.length === 0
            ? 'No dates selected yet'
            : `${sorted.length} ${sorted.length === 1 ? 'date' : 'dates'} selected`}
        </p>
        {sorted.length > 0 ? (
          <ul className="flex flex-wrap gap-2" aria-label="Selected dates">
            {sorted.map((day) => (
              <li
                key={day}
                className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground"
              >
                {chipFormatter.format(parseIsoDate(day))}
                {locked.has(day) ? (
                  <span className="text-muted-foreground">· has matches</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => toggle(day)}
                    className="rounded-full p-0.5 hover:bg-background/60"
                    aria-label={`Remove ${chipFormatter.format(parseIsoDate(day))}`}
                  >
                    <X className="size-3" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
