import type { CenterSummary } from '@acc/types';

import { cn } from '@/lib/utils';

/** Multi-centers scope: pick the participating centers of the tournament's province. */
export function CentersField({
  centers,
  value,
  onChange,
  invalid,
}: {
  centers: readonly CenterSummary[];
  value: readonly string[];
  onChange: (next: string[]) => void;
  invalid?: boolean;
}): React.ReactElement {
  if (centers.length === 0) {
    return <p className="text-sm text-muted-foreground">No centers in this province.</p>;
  }
  const selected = new Set(value);
  const allSelected = centers.every((center) => selected.has(center.id));

  return (
    <div
      id="tournament-centers"
      className={cn('rounded-md border bg-card shadow-xs', invalid && 'border-destructive')}
    >
      <div className="flex items-center justify-between border-b px-3 py-2 text-xs text-muted-foreground">
        <span>
          {value.length} of {centers.length} selected
        </span>
        <button
          type="button"
          className="font-semibold text-primary hover:underline"
          onClick={() => onChange(allSelected ? [] : centers.map((center) => center.id))}
        >
          {allSelected ? 'Clear all' : 'Select all'}
        </button>
      </div>
      <ul className="grid max-h-56 gap-1 overflow-auto p-2 @lg:grid-cols-2">
        {centers.map((center) => (
          <li key={center.id}>
            <label className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={selected.has(center.id)}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...value, center.id]
                      : value.filter((id) => id !== center.id),
                  )
                }
              />
              {center.name}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
