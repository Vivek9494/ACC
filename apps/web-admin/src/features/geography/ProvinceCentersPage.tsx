import type { CenterDetail } from '@acc/types';
import type { ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, Plus, RefreshCw } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PageHeader } from '@/components/layout/PageHeader';
import { QueryErrorCard } from '@/components/QueryErrorCard';
import { DataTable } from '@/components/data-table/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { sortByActiveThenName } from './geography';
import { useAdminCenters, useAdminProvinces, useGeographyMutations } from './geography-admin-api';
import { NameDialog } from './NameDialog';
import { RowActionsMenu } from '@/components/RowActionsMenu';

/** /geography/provinces/:provinceId — a province's centers: add, rename / move, delete. */
export function ProvinceCentersPage(): React.ReactElement {
  const { provinceId = '' } = useParams();
  const provinces = useAdminProvinces();
  const centers = useAdminCenters(provinceId);
  const mutations = useGeographyMutations();
  const province = provinces.data?.find((p) => p.id === provinceId);

  const [target, setTarget] = useState<CenterDetail | 'new' | null>(null);
  const [moveTo, setMoveTo] = useState(provinceId);
  const [pendingDelete, setPendingDelete] = useState<CenterDetail | null>(null);

  const openDialog = useCallback(
    (next: CenterDetail | 'new') => {
      setMoveTo(provinceId);
      setTarget(next);
    },
    [provinceId],
  );

  const columns = useMemo<ColumnDef<CenterDetail>[]>(
    () => [
      {
        id: 'name',
        header: 'Center',
        accessorFn: (row) => row.name,
        cell: ({ row }) => (
          <span className="flex items-center gap-2 font-semibold">
            {row.original.name}
            {!row.original.isActive ? <Badge variant="muted">Archived</Badge> : null}
          </span>
        ),
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <RowActionsMenu
            label={row.original.name}
            onEdit={() => openDialog(row.original)}
            onDelete={() => setPendingDelete(row.original)}
          />
        ),
      },
    ],
    [openDialog],
  );

  const sorted = useMemo(() => sortByActiveThenName(centers.data ?? []), [centers.data]);
  const activeProvinces = useMemo(
    () =>
      (provinces.data ?? [])
        .filter((p) => p.isActive || p.id === provinceId)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [provinces.data, provinceId],
  );

  const save = async (name: string) => {
    if (target && target !== 'new') {
      const moving = moveTo !== target.provinceId;
      await mutations.updateCenter.mutateAsync({
        id: target.id,
        body: moving ? { name, provinceId: moveTo } : { name },
      });
      const destination = activeProvinces.find((p) => p.id === moveTo)?.name;
      toast.success(moving && destination ? `${name} moved to ${destination}` : `${name} updated`);
    } else {
      await mutations.createCenter.mutateAsync({ name, provinceId });
      toast.success(`${name} added`);
    }
  };

  const runDelete = async (center: CenterDetail) => {
    await mutations.deleteCenter.mutateAsync(center.id);
    toast.success(`${center.name} deleted`);
  };

  return (
    <div>
      <Link
        to="/geography"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Geography
      </Link>

      {provinces.isError ? (
        <QueryErrorCard
          title="Couldn't load this province"
          error={provinces.error}
          onRetry={() => void provinces.refetch()}
        />
      ) : !provinces.isPending && !province ? (
        <QueryErrorCard
          title="Province not found"
          error={new Error('This province may have been deleted.')}
          onRetry={() => void provinces.refetch()}
        />
      ) : (
        <>
          <PageHeader
            title={province?.name ?? 'Province'}
            description={
              province
                ? `${province.centerCount} center${province.centerCount === 1 ? '' : 's'}`
                : 'Loading…'
            }
            actions={
              <>
                <Button
                  variant="outline"
                  onClick={() => void centers.refetch()}
                  disabled={centers.isFetching}
                >
                  <RefreshCw className={centers.isFetching ? 'animate-spin' : undefined} />
                  Refresh
                </Button>
                <Button onClick={() => openDialog('new')} disabled={!province}>
                  <Plus />
                  Add center
                </Button>
              </>
            }
          />

          {centers.isError ? (
            <QueryErrorCard
              title="Couldn't load centers"
              error={centers.error}
              onRetry={() => void centers.refetch()}
            />
          ) : (
            <DataTable
              columns={columns}
              data={sorted}
              isLoading={centers.isPending}
              getRowId={(row) => row.id}
              emptyState="No centers in this province yet."
            />
          )}
        </>
      )}

      <NameDialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
        title={target === 'new' ? 'Add center' : 'Edit center'}
        description={province ? `Province: ${province.name}` : undefined}
        entityLabel="Center"
        initialName={target && target !== 'new' ? target.name : ''}
        submitLabel={target === 'new' ? 'Save center' : 'Save changes'}
        onSubmit={save}
      >
        {target && target !== 'new' ? (
          <div className="space-y-1.5">
            <Label htmlFor="center-province">Province</Label>
            <Select value={moveTo} onValueChange={setMoveTo}>
              <SelectTrigger id="center-province">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {activeProvinces.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </NameDialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete center?"
        description={
          pendingDelete
            ? `Permanently delete "${pendingDelete.name}"? This only works when no users, registrations or tournaments use it.`
            : ''
        }
        confirmLabel="Delete"
        destructive
        onConfirm={() => (pendingDelete ? runDelete(pendingDelete) : Promise.resolve())}
      />
    </div>
  );
}
