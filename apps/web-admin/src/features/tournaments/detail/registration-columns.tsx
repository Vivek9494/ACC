import { REGISTRATION_STATUS_LABELS, RegistrationStatus, type RegistrationSummary } from '@acc/types';
import type { ColumnDef } from '@tanstack/react-table';
import { Check, Loader2, Pencil, Undo2, X } from 'lucide-react';

import { UserAvatar } from '@/components/UserAvatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { formatRating, registrationMobileLabel } from './registrations';

type BadgeVariant = React.ComponentProps<typeof Badge>['variant'];

const STATUS_BADGE: Record<RegistrationStatus, BadgeVariant> = {
  [RegistrationStatus.InWaitlist]: 'upcoming',
  [RegistrationStatus.Confirmed]: 'live',
  [RegistrationStatus.Declined]: 'destructive',
};

export interface RegistrationRowActions {
  onApprove: (row: RegistrationSummary) => void;
  onDecline: (row: RegistrationSummary) => void;
  onRevert: (row: RegistrationSummary) => void;
  onEditRatings: (row: RegistrationSummary) => void;
  /** Row with an approve in flight. */
  busyId: string | null;
}

const ratingColumn = (
  id: string,
  header: string,
  pick: (row: RegistrationSummary) => number | null,
): ColumnDef<RegistrationSummary> => ({
  id,
  header,
  accessorFn: (row) => pick(row) ?? -1,
  cell: ({ row }) => <span className="tabular-nums">{formatRating(pick(row.original))}</span>,
  meta: { headerClassName: 'text-center', cellClassName: 'text-center' },
});

/** Registered-players table; the actions column only appears while the API reports `canManage`. */
export function buildRegistrationColumns(actions?: RegistrationRowActions): ColumnDef<RegistrationSummary>[] {
  const columns: ColumnDef<RegistrationSummary>[] = [
    {
      id: 'name',
      header: 'Player',
      accessorFn: (row) => `${row.firstName} ${row.lastName}`,
      cell: ({ row }) => (
        <div className="flex min-w-[180px] items-center gap-3">
          <UserAvatar person={row.original} />
          <span className="font-semibold">
            {row.original.firstName} {row.original.lastName}
          </span>
        </div>
      ),
    },
    {
      id: 'mobile',
      header: 'Mobile',
      enableSorting: false,
      cell: ({ row }) => (
        <span className="whitespace-nowrap tabular-nums">{registrationMobileLabel(row.original)}</span>
      ),
    },
    {
      id: 'center',
      header: 'Center',
      accessorFn: (row) => row.centerName,
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.centerName}</span>,
    },
    ratingColumn('batting', 'Bat', (row) => row.battingRating),
    ratingColumn('bowling', 'Bowl', (row) => row.bowlingRating),
    ratingColumn('fielding', 'Field', (row) => row.fieldingRating),
    {
      id: 'status',
      header: 'Status',
      enableSorting: false,
      cell: ({ row }) => (
        <Badge variant={STATUS_BADGE[row.original.status]}>{REGISTRATION_STATUS_LABELS[row.original.status]}</Badge>
      ),
    },
  ];

  if (!actions) return columns;

  columns.push({
    id: 'actions',
    header: () => <span className="sr-only">Actions</span>,
    enableSorting: false,
    meta: { cellClassName: 'text-right' },
    cell: ({ row }) => {
      const reg = row.original;
      const name = `${reg.firstName} ${reg.lastName}`;
      const busy = actions.busyId === reg.id;
      return (
        <div className="flex justify-end gap-1.5">
          {reg.status === RegistrationStatus.InWaitlist ? (
            <>
              <Button
                size="icon"
                className="size-8"
                onClick={() => actions.onApprove(reg)}
                disabled={busy}
                aria-label={`Approve ${name}`}
                title="Approve"
              >
                {busy ? <Loader2 className="animate-spin" /> : <Check />}
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="size-8 text-destructive hover:text-destructive"
                onClick={() => actions.onDecline(reg)}
                disabled={busy}
                aria-label={`Decline ${name}`}
                title="Decline"
              >
                <X />
              </Button>
            </>
          ) : null}
          {reg.status === RegistrationStatus.Declined ? (
            <Button size="sm" variant="outline" onClick={() => actions.onRevert(reg)} aria-label={`Move ${name} to waitlist`}>
              <Undo2 />
              Revert
            </Button>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              onClick={() => actions.onEditRatings(reg)}
              disabled={busy}
              aria-label={`Edit ratings for ${name}`}
              title="Edit ratings"
            >
              <Pencil />
            </Button>
          )}
        </div>
      );
    },
  });
  return columns;
}
