import {
  BALL_TYPE_LABELS,
  BallType,
  TOURNAMENT_DISPLAY_STATUS_LABELS,
  TOURNAMENT_TYPE_LABELS,
  TournamentDisplayStatus,
  TournamentType,
  type TournamentSummary,
} from '@acc/types';
import type { ColumnDef } from '@tanstack/react-table';
import { AlertCircle, CalendarClock, CheckCircle2, Plus, Radio, RefreshCw, Search, Trophy, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { DataTable } from '@/components/data-table/DataTable';
import { PageHeader } from '@/components/layout/PageHeader';
import { RowActionsMenu } from '@/components/RowActionsMenu';
import { StatCard } from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { tournamentColumns } from './columns';
import { DeleteTournamentDialog, type DeletableTournament } from './manage/DeleteTournamentDialog';
import { useTournamentPermissions } from './manage/tournament-manage-api';
import {
  ALL,
  countByStatus,
  DEFAULT_TOURNAMENT_FILTERS,
  filterTournaments,
  type FilterValue,
  type TournamentFilters,
} from './tournament-list';
import { useTournaments } from './use-tournaments';

function FilterSelect<T extends string>({
  label,
  value,
  options,
  labels,
  onChange,
}: {
  label: string;
  value: FilterValue<T>;
  options: readonly T[];
  labels: Record<T, string>;
  onChange: (value: FilterValue<T>) => void;
}): React.ReactElement {
  const isOption = (v: string): v is T => options.some((o) => o === v);
  return (
    <Select value={value} onValueChange={(v) => onChange(isOption(v) ? v : ALL)}>
      <SelectTrigger className="w-[170px]" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All {label.toLowerCase()}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {labels[o]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function TournamentsPage(): React.ReactElement {
  const query = useTournaments();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<TournamentFilters>(DEFAULT_TOURNAMENT_FILTERS);
  const [pendingDelete, setPendingDelete] = useState<DeletableTournament | null>(null);
  const permissions = useTournamentPermissions();

  const columns = useMemo<ColumnDef<TournamentSummary>[]>(
    () => [
      ...tournamentColumns,
      {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        cell: ({ row }) => {
          const allowed = permissions.data?.get(row.original.id);
          if (!allowed?.canEdit && !allowed?.canDelete) return null;
          return (
            <RowActionsMenu
              label={row.original.name}
              onEdit={allowed.canEdit ? () => void navigate(`${row.original.id}/edit`) : undefined}
              onDelete={allowed.canDelete ? () => setPendingDelete(row.original) : undefined}
            />
          );
        },
      },
    ],
    [permissions.data, navigate],
  );

  const all = useMemo(() => query.data ?? [], [query.data]);
  const rows = useMemo(() => filterTournaments(all, filters), [all, filters]);
  const counts = useMemo(() => countByStatus(all), [all]);
  const isFiltered =
    filters.search.trim() !== '' ||
    filters.ballType !== ALL ||
    filters.status !== ALL ||
    filters.type !== ALL;
  const stat = (n: number): number | string => (query.isPending ? '—' : n);

  const update = <K extends keyof TournamentFilters>(key: K, value: TournamentFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));

  return (
    <div>
      <PageHeader
        title="Tournaments"
        description="Every ACC, APL and Center-level tournament on the platform."
        actions={
          <>
            <Button variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}>
              <RefreshCw className={query.isFetching ? 'animate-spin' : undefined} />
              Refresh
            </Button>
            <Button onClick={() => void navigate('new')}>
              <Plus />
              Add tournament
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Total" value={stat(all.length)} icon={Trophy} accent="bg-secondary/10 text-secondary" />
        <StatCard label="Live" value={stat(counts.LIVE)} icon={Radio} accent="bg-primary/15 text-primary" />
        <StatCard
          label="Upcoming"
          value={stat(counts.UPCOMING)}
          icon={CalendarClock}
          accent="bg-secondary/10 text-secondary"
        />
        <StatCard
          label="Completed"
          value={stat(counts.COMPLETED)}
          icon={CheckCircle2}
          accent="bg-muted text-muted-foreground"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(e) => update('search', e.target.value)}
            placeholder="Search name, location or year"
            className="pl-9"
            aria-label="Search tournaments"
          />
        </div>
        <FilterSelect
          label="Statuses"
          value={filters.status}
          options={Object.values(TournamentDisplayStatus)}
          labels={TOURNAMENT_DISPLAY_STATUS_LABELS}
          onChange={(v) => update('status', v)}
        />
        <FilterSelect
          label="Ball types"
          value={filters.ballType}
          options={Object.values(BallType)}
          labels={BALL_TYPE_LABELS}
          onChange={(v) => update('ballType', v)}
        />
        <FilterSelect
          label="Types"
          value={filters.type}
          options={Object.values(TournamentType)}
          labels={TOURNAMENT_TYPE_LABELS}
          onChange={(v) => update('type', v)}
        />
        {isFiltered ? (
          <Button variant="ghost" onClick={() => setFilters(DEFAULT_TOURNAMENT_FILTERS)}>
            <X />
            Clear filters
          </Button>
        ) : null}
      </div>

      {query.isError ? (
        <Card className="py-0">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <AlertCircle className="size-8 text-destructive" />
            <div>
              <p className="font-semibold">Couldn't load tournaments</p>
              <p className="text-sm text-muted-foreground">{query.error.message}</p>
            </div>
            <Button variant="outline" onClick={() => void query.refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          isLoading={query.isPending}
          getRowId={(t) => t.id}
          onRowClick={(t) => void navigate(t.id)}
          initialSorting={[{ id: 'dates', desc: true }]}
          resetPageKey={JSON.stringify(filters)}
          emptyState={
            isFiltered ? 'No tournaments match these filters.' : 'No tournaments have been created yet.'
          }
        />
      )}

      <DeleteTournamentDialog tournament={pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)} />
    </div>
  );
}
