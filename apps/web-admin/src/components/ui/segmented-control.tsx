import { cn } from '@/lib/utils';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

/** Pill-style single-choice toggle (range presets, table views). */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
}): React.ReactElement {
  return (
    <div role="tablist" aria-label={ariaLabel} className="inline-flex rounded-md border bg-card p-0.5 shadow-xs">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-[5px] px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
              selected ? 'bg-secondary text-secondary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
