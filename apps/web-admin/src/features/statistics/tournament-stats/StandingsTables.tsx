import type { TournamentStandings } from '@acc/types';
import type { UseQueryResult } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { useMemo } from 'react';

import { DataTable } from '@/components/data-table/DataTable';
import { QueryErrorCard } from '@/components/QueryErrorCard';

import { standingsColumns } from './stat-columns';

/** Points table per group (or combined), with team logos and excluded-match warnings. */
export function StandingsTables({
  standings,
}: {
  standings: UseQueryResult<TournamentStandings>;
}): React.ReactElement {
  const columns = useMemo(
    () => standingsColumns(standings.data?.showNetRunRate ?? false),
    [standings.data?.showNetRunRate],
  );

  if (standings.isError) {
    return (
      <QueryErrorCard
        title="Couldn't load the points table"
        error={standings.error}
        onRetry={() => void standings.refetch()}
      />
    );
  }

  const tables = standings.data?.tables ?? [];
  const dataErrors = standings.data?.dataErrors ?? [];

  return (
    <div className="space-y-6">
      {dataErrors.length > 0 ? (
        <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <p className="font-semibold text-destructive">
              {dataErrors.length} match{dataErrors.length === 1 ? ' is' : 'es are'} excluded from the table
            </p>
            <ul className="mt-1 list-disc pl-4 text-muted-foreground">
              {dataErrors.map((err) => (
                <li key={err.matchId}>{err.message}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
      {standings.isPending ? (
        <DataTable columns={columns} data={[]} isLoading />
      ) : tables.length === 0 ? (
        <DataTable columns={columns} data={[]} emptyState="No teams in this tournament yet." />
      ) : (
        tables.map((table) => (
          <section key={table.groupId ?? 'combined'} className="space-y-2">
            {tables.length > 1 ? (
              <h3 className="text-sm font-bold tracking-wide text-secondary uppercase">{table.groupName}</h3>
            ) : null}
            <DataTable
              columns={columns}
              data={table.teams}
              getRowId={(row) => row.teamId}
              emptyState="No teams in this group yet."
            />
          </section>
        ))
      )}
    </div>
  );
}
