import { formatPasswordResetOtpDayLabel, type AdminPasswordResetOtpDayCount } from '@acc/types';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';

const BAR = 'var(--primary)';
const BAR_SELECTED = 'var(--secondary)';
const BAR_DIMMED = 'color-mix(in srgb, var(--primary) 45%, transparent)';

function ChartTooltip({ active, payload, label }: TooltipContentProps<ValueType, NameType>): React.ReactElement | null {
  const count = payload?.[0]?.value;
  if (!active || typeof label !== 'string' || typeof count !== 'number') return null;
  return (
    <div className="rounded-md border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-semibold text-secondary">{formatPasswordResetOtpDayLabel(label)} (UTC)</p>
      <p className="text-muted-foreground">
        {count} OTP{count === 1 ? '' : 's'} sent{count > 0 ? ' · click for recipients' : ''}
      </p>
    </div>
  );
}

/** Password-reset OTP sends per UTC day; clicking a column selects that day. */
export function OtpBarChart({
  days,
  selectedDate,
  onSelectDate,
}: {
  days: readonly AdminPasswordResetOtpDayCount[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}): React.ReactElement {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart
        data={[...days]}
        margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
        className="cursor-pointer"
        onClick={(state) => {
          const index = Number(state.activeIndex);
          const day = Number.isInteger(index) ? days[index] : undefined;
          if (day) onSelectDate(day.date);
        }}
      >
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="date"
          tickFormatter={formatPasswordResetOtpDayLabel}
          tickLine={false}
          axisLine={{ stroke: 'var(--border)' }}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
          minTickGap={12}
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
        />
        <Tooltip content={ChartTooltip} cursor={{ fill: 'var(--accent)' }} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false}>
          {days.map((day) => (
            <Cell
              key={day.date}
              fill={selectedDate === null ? BAR : day.date === selectedDate ? BAR_SELECTED : BAR_DIMMED}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
