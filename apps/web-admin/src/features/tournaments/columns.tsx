import {
  BALL_TYPE_LABELS,
  TOURNAMENT_DISPLAY_STATUS_LABELS,
  TOURNAMENT_TYPE_LABELS,
  type TournamentDisplayStatus,
  type TournamentSummary,
} from '@acc/types';
import type { ColumnDef } from '@tanstack/react-table';

import { Badge } from '@/components/ui/badge';

import { formatTournamentDates, tournamentLocationLabel } from './tournament-list';

export const STATUS_BADGE: Record<
  TournamentDisplayStatus,
  'live' | 'upcoming' | 'muted' | 'destructive'
> = {
  LIVE: 'live',
  UPCOMING: 'upcoming',
  COMPLETED: 'muted',
  CANCELLED: 'destructive',
};

export const tournamentColumns: ColumnDef<TournamentSummary>[] = [
  {
    id: 'name',
    accessorKey: 'name',
    header: 'Tournament',
    cell: ({ row }) => (
      <div className="min-w-[220px]">
        <p className="font-semibold text-foreground">{row.original.name}</p>
        <p className="text-xs text-muted-foreground">
          {TOURNAMENT_TYPE_LABELS[row.original.type]} · {row.original.year}
        </p>
      </div>
    ),
  },
  {
    id: 'ballType',
    accessorKey: 'ballType',
    header: 'Ball type',
    cell: ({ row }) => BALL_TYPE_LABELS[row.original.ballType],
  },
  {
    id: 'status',
    accessorKey: 'displayStatus',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.original.displayStatus;
      return (
        <Badge variant={STATUS_BADGE[status]}>
          {status === 'LIVE' ? <span className="size-1.5 rounded-full bg-primary" /> : null}
          {TOURNAMENT_DISPLAY_STATUS_LABELS[status]}
        </Badge>
      );
    },
  },
  {
    id: 'dates',
    accessorKey: 'startAt',
    header: 'Dates',
    sortingFn: 'datetime',
    cell: ({ row }) => (
      <span className="whitespace-nowrap">
        {formatTournamentDates(row.original.startAt, row.original.endAt)}
      </span>
    ),
  },
  {
    id: 'location',
    accessorFn: (t) => tournamentLocationLabel(t),
    header: 'Location',
    cell: ({ getValue }) => (
      <span className="line-clamp-2 max-w-[320px] text-muted-foreground">{String(getValue())}</span>
    ),
  },
  {
    id: 'teams',
    accessorKey: 'teamCount',
    header: 'Teams',
    meta: { headerClassName: 'text-right', cellClassName: 'text-right tabular-nums' },
  },
];
