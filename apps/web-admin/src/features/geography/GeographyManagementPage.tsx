import {
  BALL_TYPE_LABELS,
  type CreateTournamentTypeDefinitionRequest,
  type ProvinceDetail,
  type TournamentTypeDefinitionSummary,
} from '@acc/types';
import type { ColumnDef } from '@tanstack/react-table';
import { ChevronRight, Plus, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PageHeader } from '@/components/layout/PageHeader';
import { QueryErrorCard } from '@/components/QueryErrorCard';
import { DataTable } from '@/components/data-table/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { sortByActiveThenName } from './geography';
import {
  useAdminProvinces,
  useGeographyMutations,
  useTournamentTypes,
} from './geography-admin-api';
import { NameDialog } from './NameDialog';
import { RowActionsMenu } from '@/components/RowActionsMenu';
import { TournamentTypeDialog } from './TournamentTypeDialog';

type PendingDelete =
  | { kind: 'type'; row: TournamentTypeDefinitionSummary }
  | { kind: 'province'; row: ProvinceDetail };

function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold text-secondary">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

/** /geography — tournament types and provinces (Admin), mirroring the mobile Geography tab. */
export function GeographyManagementPage(): React.ReactElement {
  const navigate = useNavigate();
  const types = useTournamentTypes();
  const provinces = useAdminProvinces();
  const mutations = useGeographyMutations();

  const [typeTarget, setTypeTarget] = useState<string | null>(null);
  const [provinceTarget, setProvinceTarget] = useState<ProvinceDetail | 'new' | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  const typeColumns = useMemo<ColumnDef<TournamentTypeDefinitionSummary>[]>(
    () => [
      {
        id: 'name',
        header: 'Name',
        accessorFn: (row) => row.name,
        cell: ({ row }) => <span className="font-semibold">{row.original.name}</span>,
      },
      { id: 'province', header: 'Province', accessorFn: (row) => row.provinceName },
      {
        id: 'ballType',
        header: 'Ball type',
        accessorFn: (row) => BALL_TYPE_LABELS[row.ballType],
        cell: ({ row }) => <Badge variant="muted">{BALL_TYPE_LABELS[row.original.ballType]}</Badge>,
      },
      {
        id: 'centers',
        header: 'Centers',
        accessorFn: (row) => row.centerCount,
        meta: { headerClassName: 'text-right', cellClassName: 'text-right tabular-nums' },
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <RowActionsMenu
            label={row.original.name}
            onEdit={() => setTypeTarget(row.original.id)}
            onDelete={() => setPendingDelete({ kind: 'type', row: row.original })}
          />
        ),
      },
    ],
    [],
  );

  const provinceColumns = useMemo<ColumnDef<ProvinceDetail>[]>(
    () => [
      {
        id: 'name',
        header: 'Province',
        accessorFn: (row) => row.name,
        cell: ({ row }) => (
          <span className="flex items-center gap-2 font-semibold">
            {row.original.name}
            {!row.original.isActive ? <Badge variant="muted">Archived</Badge> : null}
          </span>
        ),
      },
      {
        id: 'centers',
        header: 'Centers',
        accessorFn: (row) => row.centerCount,
        meta: { headerClassName: 'text-right', cellClassName: 'text-right tabular-nums' },
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        meta: { cellClassName: 'w-24' },
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <RowActionsMenu
              label={row.original.name}
              onEdit={() => setProvinceTarget(row.original)}
              onDelete={() => setPendingDelete({ kind: 'province', row: row.original })}
            />
            <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
          </div>
        ),
      },
    ],
    [],
  );

  const sortedProvinces = useMemo(
    () => sortByActiveThenName(provinces.data ?? []),
    [provinces.data],
  );

  const saveType = async (id: string | null, body: CreateTournamentTypeDefinitionRequest) => {
    if (id) {
      await mutations.updateType.mutateAsync({ id, body });
      toast.success(`${body.name} updated`);
    } else {
      await mutations.createType.mutateAsync(body);
      toast.success(`${body.name} created`);
    }
  };

  const saveProvince = async (name: string) => {
    if (provinceTarget && provinceTarget !== 'new') {
      await mutations.updateProvince.mutateAsync({ id: provinceTarget.id, body: { name } });
      toast.success(`${name} updated`);
    } else {
      await mutations.createProvince.mutateAsync({ name });
      toast.success(`${name} added`);
    }
  };

  const runDelete = async (pending: PendingDelete) => {
    if (pending.kind === 'type') await mutations.deleteType.mutateAsync(pending.row.id);
    else await mutations.deleteProvince.mutateAsync(pending.row.id);
    toast.success(`${pending.row.name} deleted`);
  };

  const refreshing = types.isFetching || provinces.isFetching;

  return (
    <div>
      <PageHeader
        title="Geography"
        description="Tournament types, provinces and centers."
        actions={
          <Button
            variant="outline"
            onClick={() => {
              void types.refetch();
              void provinces.refetch();
            }}
            disabled={refreshing}
          >
            <RefreshCw className={refreshing ? 'animate-spin' : undefined} />
            Refresh
          </Button>
        }
      />

      <div className="grid items-start gap-8 2xl:grid-cols-2">
        <section>
          <SectionHeader
            title="Tournament types"
            description="Name, province, ball type and participating centers."
            action={
              <Button onClick={() => setTypeTarget('new')}>
                <Plus />
                Add tournament type
              </Button>
            }
          />
          {types.isError ? (
            <QueryErrorCard
              title="Couldn't load tournament types"
              error={types.error}
              onRetry={() => void types.refetch()}
            />
          ) : (
            <DataTable
              columns={typeColumns}
              data={types.data ?? []}
              isLoading={types.isPending}
              getRowId={(row) => row.id}
              initialSorting={[{ id: 'name', desc: false }]}
              emptyState="No tournament types yet."
            />
          )}
        </section>

        <section>
          <SectionHeader
            title="Provinces"
            description="Open a province to manage its centers."
            action={
              <Button onClick={() => setProvinceTarget('new')}>
                <Plus />
                Add province
              </Button>
            }
          />
          {provinces.isError ? (
            <QueryErrorCard
              title="Couldn't load provinces"
              error={provinces.error}
              onRetry={() => void provinces.refetch()}
            />
          ) : (
            <DataTable
              columns={provinceColumns}
              data={sortedProvinces}
              isLoading={provinces.isPending}
              getRowId={(row) => row.id}
              onRowClick={(row) => void navigate(`provinces/${encodeURIComponent(row.id)}`)}
              emptyState="No provinces yet."
            />
          )}
        </section>
      </div>

      <TournamentTypeDialog
        target={typeTarget}
        onOpenChange={(open) => {
          if (!open) setTypeTarget(null);
        }}
        onSubmit={saveType}
      />

      <NameDialog
        open={provinceTarget !== null}
        onOpenChange={(open) => {
          if (!open) setProvinceTarget(null);
        }}
        title={provinceTarget === 'new' ? 'Add province' : 'Edit province'}
        entityLabel="Province"
        initialName={provinceTarget && provinceTarget !== 'new' ? provinceTarget.name : ''}
        submitLabel={provinceTarget === 'new' ? 'Save province' : 'Save changes'}
        onSubmit={saveProvince}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={pendingDelete?.kind === 'type' ? 'Delete tournament type?' : 'Delete province?'}
        description={
          pendingDelete?.kind === 'type'
            ? `Delete "${pendingDelete.row.name}"? It will no longer be offered when creating tournaments.`
            : pendingDelete
              ? `Permanently delete "${pendingDelete.row.name}"? This only works when it has no centers.`
              : ''
        }
        confirmLabel="Delete"
        destructive
        onConfirm={() => (pendingDelete ? runDelete(pendingDelete) : Promise.resolve())}
      />
    </div>
  );
}
