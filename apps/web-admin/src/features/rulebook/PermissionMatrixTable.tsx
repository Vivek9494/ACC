import { Check } from 'lucide-react';
import { useMemo } from 'react';

import { Badge } from '@/components/ui/badge';

import { GRANT_SUBJECT_LABELS } from './rulebook-content';
import { buildPermissionMatrixRows, MATRIX_SUBJECTS } from './rulebook-model';

/** Read-only view of PERMISSION_MATRIX from @acc/types. */
export function PermissionMatrixTable(): React.ReactElement {
  const rows = useMemo(() => buildPermissionMatrixRows(), []);

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted/60 text-left text-xs text-muted-foreground">
          <tr>
            <th className="min-w-[220px] px-3 py-2 font-medium">Action</th>
            {MATRIX_SUBJECTS.map((subject) => (
              <th key={subject} className="px-2 py-2 text-center font-medium whitespace-nowrap">
                {GRANT_SUBJECT_LABELS[subject]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.permission} className="border-t align-top">
              <td className="px-3 py-2">
                <div className="font-medium">{row.label}</div>
                {row.restriction ? (
                  <Badge variant="muted" className="mt-1">
                    {row.restriction} only
                  </Badge>
                ) : null}
              </td>
              {row.cells.map((qualifiers, i) => (
                <td key={MATRIX_SUBJECTS[i]} className="px-2 py-2 text-center">
                  {qualifiers === null ? (
                    <span className="text-muted-foreground/50">—</span>
                  ) : (
                    <div className="flex flex-col items-center gap-0.5">
                      <Check className="size-4 text-primary" aria-label="Allowed" />
                      {qualifiers.map((q) => (
                        <span key={q} className="text-[11px] leading-tight text-muted-foreground">
                          {q}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
