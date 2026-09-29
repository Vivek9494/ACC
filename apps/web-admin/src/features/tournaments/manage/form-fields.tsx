import type { TournamentFormFieldKey } from '@acc/types';
import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

/** Label + control + error/hint. `field` lets the form scroll to the first invalid row. */
export function FieldShell({
  id,
  field,
  label,
  error,
  hint,
  className,
  children,
}: {
  id: string;
  field?: TournamentFormFieldKey;
  label: string;
  error?: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}): React.ReactElement {
  return (
    <div className={cn('space-y-1.5', className)} data-field={field}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Locked-on-edit value (ball type, year, scope) — shown, never editable. */
export function ReadOnlyValue({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}): React.ReactElement {
  return (
    <div
      id={id}
      className="flex min-h-9 items-center gap-2 rounded-md border border-dashed bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
    >
      <Lock className="size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  );
}

export interface ChoiceOption {
  value: string;
  label: string;
}

export function ChoiceSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  disabled,
  invalid,
}: {
  id: string;
  value: string | null;
  onChange: (value: string) => void;
  options: readonly ChoiceOption[];
  placeholder: string;
  disabled?: boolean;
  invalid?: boolean;
}): React.ReactElement {
  return (
    <Select value={value ?? ''} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} aria-invalid={invalid}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function CheckboxRow({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}): React.ReactElement {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 rounded-md py-1">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-primary"
      />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {description ? (
          <span className="block text-xs text-muted-foreground">{description}</span>
        ) : null}
      </span>
    </label>
  );
}

/** Local date + time pair (converted to UTC ISO on submit). */
export function DateTimeRow({
  idPrefix,
  dateField,
  timeField,
  dateLabel,
  timeLabel,
  date,
  time,
  onDateChange,
  onTimeChange,
  dateError,
  timeError,
  minDate,
}: {
  idPrefix: string;
  dateField: TournamentFormFieldKey;
  timeField: TournamentFormFieldKey;
  dateLabel: string;
  timeLabel: string;
  date: string;
  time: string;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  dateError?: string;
  timeError?: string;
  minDate?: string;
}): React.ReactElement {
  return (
    <div className="grid gap-4 @lg:grid-cols-2">
      <FieldShell id={`${idPrefix}-date`} field={dateField} label={dateLabel} error={dateError}>
        <Input
          id={`${idPrefix}-date`}
          type="date"
          value={date}
          min={minDate}
          onChange={(e) => onDateChange(e.target.value)}
          aria-invalid={Boolean(dateError)}
        />
      </FieldShell>
      <FieldShell id={`${idPrefix}-time`} field={timeField} label={timeLabel} error={timeError}>
        <Input
          id={`${idPrefix}-time`}
          type="time"
          value={time}
          onChange={(e) => onTimeChange(e.target.value)}
          aria-invalid={Boolean(timeError)}
        />
      </FieldShell>
    </div>
  );
}
