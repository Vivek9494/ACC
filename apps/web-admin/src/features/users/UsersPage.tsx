import {
  ADMIN_PLATFORM_ROLES,
  ADMIN_USER_ROLE_LABELS,
  UserRole,
  canManageAdminUsers,
  type AdminUserSummary,
  type CreateAdminUserResponse,
} from '@acc/types';
import { AlertCircle, Eye, Plus, RefreshCw, Search, ShieldCheck, UserCog, Users, X, type LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { useAuth } from '@/auth/auth-context';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable } from '@/components/data-table/DataTable';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { centersInProvince, useCenters, useProvinces } from '@/features/geography/use-geography';
import { errorMessage } from '@/lib/api-client';
import { cn } from '@/lib/utils';

import { buildUserColumns, type UserRowActions } from './columns';
import { TempPasswordDialog } from './TempPasswordDialog';
import {
  currentCursor,
  DEFAULT_USER_FILTERS,
  FIRST_PAGE,
  hasActiveUserFilters,
  nextPage,
  previousPage,
  toListParams,
  userDisplayName,
  withCenter,
  withProvince,
  type CursorPaging,
  type UserListFilters,
} from './user-list';
import { UserFormDialog, type UserFormTarget } from './UserFormDialog';
import {
  useAdminUsersPage,
  useDeleteAdminUser,
  useSetAdminUserStatus,
  useUnlockAdminUser,
} from './users-api';

const SEARCH_DEBOUNCE_MS = 350;
const DEFAULT_PAGE_SIZE = 25;
const ALL = 'ALL';

const ROLE_CARD_ICON: Partial<Record<UserRole, LucideIcon>> = {
  [UserRole.Admin]: ShieldCheck,
  [UserRole.ClubManager]: UserCog,
  [UserRole.CenterSevak]: UserCog,
  [UserRole.Player]: Users,
};

type PendingAction =
  | { kind: 'status'; user: AdminUserSummary }
  | { kind: 'delete'; user: AdminUserSummary }
  | { kind: 'unlock'; user: AdminUserSummary };

function isPlatformRole(value: string): value is UserRole {
  return ADMIN_PLATFORM_ROLES.some((role) => role === value);
}

function CountCard({
  label,
  value,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  active: boolean;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className="text-left">
      <Card
        className={cn(
          'py-0 transition-colors hover:border-primary/50',
          active && 'border-primary ring-2 ring-primary/20',
        )}
      >
        <CardContent className="flex items-center gap-3 p-4">
          <span
            className={cn(
              'flex size-10 items-center justify-center rounded-lg',
              active ? 'bg-primary text-primary-foreground' : 'bg-secondary/10 text-secondary',
            )}
          >
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
            <p className="text-2xl font-bold tabular-nums">{value}</p>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

function confirmCopy(action: PendingAction): {
  title: string;
  description: string;
  confirmLabel: string;
  destructive: boolean;
} {
  const name = userDisplayName(action.user);
  if (action.kind === 'delete') {
    return {
      title: `Delete ${name}?`,
      description: "They'll be signed out and removed from the directory. This can't be undone.",
      confirmLabel: 'Delete',
      destructive: true,
    };
  }
  if (action.kind === 'unlock') {
    return {
      title: `Unlock ${name}?`,
      description: 'This clears their password-reset lock so they can request a new OTP.',
      confirmLabel: 'Unlock',
      destructive: false,
    };
  }
  return action.user.isActive
    ? {
        title: `Deactivate ${name}?`,
        description:
          "They won't be able to log in and won't appear in invites, rosters, or team selection. You can reactivate them later.",
        confirmLabel: 'Deactivate',
        destructive: true,
      }
    : {
        title: `Reactivate ${name}?`,
        description: "They'll be able to log in and appear in selection lists again.",
        confirmLabel: 'Reactivate',
        destructive: false,
      };
}

export function UsersPage(): React.ReactElement {
  const { user: viewer } = useAuth();
  const canManage = viewer ? canManageAdminUsers(viewer.role) : false;

  const [filters, setFilters] = useState<UserListFilters>(DEFAULT_USER_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [formTarget, setFormTarget] = useState<UserFormTarget | null>(null);
  const [created, setCreated] = useState<CreateAdminUserResponse | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(filters.search), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [filters.search]);

  // Paging belongs to one filter set — any filter / page-size change starts at page 1.
  const filterKey = JSON.stringify([debouncedSearch, filters.provinceId, filters.centerId, filters.role, pageSize]);
  const [pagingState, setPagingState] = useState<{ key: string; paging: CursorPaging }>({
    key: filterKey,
    paging: FIRST_PAGE,
  });
  if (pagingState.key !== filterKey) {
    setPagingState({ key: filterKey, paging: FIRST_PAGE });
  }
  const paging = pagingState.key === filterKey ? pagingState.paging : FIRST_PAGE;
  const setPaging = (next: CursorPaging) => setPagingState({ key: filterKey, paging: next });

  const provinces = useProvinces();
  const centers = useCenters();
  const allCenters = useMemo(() => centers.data ?? [], [centers.data]);
  const centerOptions = useMemo(
    () => centersInProvince(allCenters, filters.provinceId),
    [allCenters, filters.provinceId],
  );

  const query = useAdminUsersPage(
    toListParams({ ...filters, search: debouncedSearch }, currentCursor(paging), pageSize),
  );
  const page = query.data;

  // Deleting the last row of a later page leaves it empty — step back.
  useEffect(() => {
    if (page && page.items.length === 0 && paging.pageIndex > 0 && !query.isFetching) {
      setPagingState((s) => ({ ...s, paging: previousPage(s.paging) }));
    }
  }, [page, paging.pageIndex, query.isFetching]);

  const setStatus = useSetAdminUserStatus();
  const deleteUser = useDeleteAdminUser();
  const unlockUser = useUnlockAdminUser();

  const actions = useMemo<UserRowActions | undefined>(
    () =>
      canManage
        ? {
            onEdit: (u) => setFormTarget({ mode: 'edit', userId: u.id }),
            onToggleStatus: (u) => setPending({ kind: 'status', user: u }),
            onDelete: (u) => setPending({ kind: 'delete', user: u }),
            onUnlock: (u) => setPending({ kind: 'unlock', user: u }),
          }
        : undefined,
    [canManage],
  );
  const columns = useMemo(() => buildUserColumns({ actions, currentUserId: viewer?.id }), [actions, viewer?.id]);

  const runPending = async (action: PendingAction) => {
    const name = userDisplayName(action.user);
    if (action.kind === 'delete') {
      await deleteUser.mutateAsync(action.user.id);
      toast.success(`${name} deleted`);
    } else if (action.kind === 'unlock') {
      await unlockUser.mutateAsync({ userId: action.user.id });
      toast.success(`${name} unlocked`);
    } else {
      const next = !action.user.isActive;
      await setStatus.mutateAsync({ userId: action.user.id, body: { isActive: next } });
      toast.success(`${name} ${next ? 'reactivated' : 'deactivated'}`);
    }
  };

  // Older API deployments omit roleCounts; show a dash rather than a misleading 0.
  const countsAvailable = page?.roleCounts !== undefined;
  const roleCounts = page?.roleCounts ?? {};
  const totalAcrossRoles = Object.values(roleCounts).reduce((sum, n) => sum + (n ?? 0), 0);
  const stat = (n: number): number | string => (query.isPending || !countsAvailable ? '—' : n);
  const isFiltered = hasActiveUserFilters(filters);

  return (
    <div>
      <PageHeader
        title="Users"
        description="System-wide user directory across every province and center."
        actions={
          <>
            <Button variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}>
              <RefreshCw className={query.isFetching ? 'animate-spin' : undefined} />
              Refresh
            </Button>
            {canManage ? (
              <Button onClick={() => setFormTarget({ mode: 'create' })}>
                <Plus />
                Add user
              </Button>
            ) : null}
          </>
        }
      />

      {!canManage ? (
        <p className="mb-5 flex items-center gap-2 rounded-md border border-secondary/20 bg-secondary/5 px-3 py-2 text-sm text-secondary">
          <Eye className="size-4 shrink-0" />
          View only — adding, editing and removing users is limited to Admins.
        </p>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <CountCard
          label="All users"
          value={stat(totalAcrossRoles)}
          icon={Users}
          active={filters.role === null}
          onClick={() => setFilters((f) => ({ ...f, role: null }))}
        />
        {ADMIN_PLATFORM_ROLES.map((role) => (
          <CountCard
            key={role}
            label={ADMIN_USER_ROLE_LABELS[role]}
            value={stat(roleCounts[role] ?? 0)}
            icon={ROLE_CARD_ICON[role] ?? Users}
            active={filters.role === role}
            onClick={() => setFilters((f) => ({ ...f, role: f.role === role ? null : role }))}
          />
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            placeholder="Search by name or mobile number"
            className="pl-9"
            aria-label="Search users"
          />
        </div>
        <Select
          value={filters.provinceId ?? ALL}
          onValueChange={(v) => setFilters((f) => withProvince(f, v === ALL ? null : v, allCenters))}
          disabled={provinces.isPending}
        >
          <SelectTrigger className="w-[180px]" aria-label="Province">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All provinces</SelectItem>
            {(provinces.data ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.centerId ?? ALL}
          onValueChange={(v) => setFilters((f) => withCenter(f, v === ALL ? null : v, allCenters))}
          disabled={centers.isPending}
        >
          <SelectTrigger className="w-[200px]" aria-label="Center">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All centers</SelectItem>
            {centerOptions.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.role ?? ALL}
          onValueChange={(v) => setFilters((f) => ({ ...f, role: isPlatformRole(v) ? v : null }))}
        >
          <SelectTrigger className="w-[170px]" aria-label="Role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All roles</SelectItem>
            {ADMIN_PLATFORM_ROLES.map((role) => (
              <SelectItem key={role} value={role}>
                {ADMIN_USER_ROLE_LABELS[role]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isFiltered ? (
          <Button variant="ghost" onClick={() => setFilters(DEFAULT_USER_FILTERS)}>
            <X />
            Clear filters
          </Button>
        ) : null}
      </div>

      {query.isError && !page ? (
        <Card className="py-0">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <AlertCircle className="size-8 text-destructive" />
            <div>
              <p className="font-semibold">Couldn&apos;t load users</p>
              <p className="text-sm text-muted-foreground">{errorMessage(query.error)}</p>
            </div>
            <Button variant="outline" onClick={() => void query.refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : (
        <DataTable
          columns={columns}
          data={page?.items ?? []}
          isLoading={query.isPending}
          getRowId={(u) => u.id}
          emptyState={isFiltered ? 'No users match your search or filters.' : 'No users yet.'}
          serverPagination={{
            pageIndex: paging.pageIndex,
            pageSize,
            totalCount: page?.totalCount ?? 0,
            hasNextPage: Boolean(page?.nextCursor),
            onNextPage: () => setPaging(nextPage(paging, page?.nextCursor ?? null)),
            onPreviousPage: () => setPaging(previousPage(paging)),
            onPageSizeChange: setPageSize,
            isFetching: query.isFetching,
          }}
        />
      )}

      {canManage ? (
        <>
          <UserFormDialog
            target={formTarget}
            onClose={() => setFormTarget(null)}
            onCreated={(result) => {
              setFormTarget(null);
              setCreated(result);
            }}
          />
          <TempPasswordDialog result={created} onClose={() => setCreated(null)} />
          {pending ? (
            <ConfirmDialog
              open
              onOpenChange={(open) => !open && setPending(null)}
              {...confirmCopy(pending)}
              onConfirm={() => runPending(pending)}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
