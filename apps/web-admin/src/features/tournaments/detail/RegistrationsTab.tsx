import {
  RegistrationStatus,
  UserRole,
  type RegistrationSummary,
  type TournamentDetail,
  type UpdateRatingsRequest,
} from '@acc/types';
import { CheckCircle2, Info, Lock, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { toast } from 'sonner';

import { useAuth } from '@/auth/auth-context';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { QueryErrorCard } from '@/components/QueryErrorCard';
import { DataTable } from '@/components/data-table/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { errorMessage } from '@/lib/api-client';
import { cn } from '@/lib/utils';

import { RatingsDialog } from './RatingsDialog';
import { InlineRatingEditContext, type InlineRatingEdit } from './inline-rating-edit';
import { buildRegistrationColumns, type RegistrationRowActions } from './registration-columns';
import {
  ALL_CENTERS,
  REGISTRATION_STATUS_TABS,
  countByStatus,
  defaultRegistrationStatus,
  filterRegistrations,
  parseRatingDraft,
  ratingDraftFrom,
  registrationCenters,
  resolveVerificationState,
  type RatingDraft,
  type RatingKey,
  type RegistrationFilters,
  type VerificationState,
} from './registrations';
import {
  useRegisteredPlayers,
  useRegistrationActions,
  useTournamentDetail,
  useVerificationQueue,
} from './tournament-detail-api';

type PendingConfirm = { kind: 'decline' | 'revert'; row: RegistrationSummary };

const fullName = (row: RegistrationSummary): string => `${row.firstName} ${row.lastName}`;

const EMPTY_RATINGS = { battingRating: null, bowlingRating: null, fieldingRating: null };

function formatWhen(date: Date, timezone: string | null): string {
  return new Intl.DateTimeFormat('en-CA', {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...(timezone ? { timeZone: timezone } : {}),
  }).format(date);
}

function Notice({
  icon: Icon,
  tone = 'muted',
  children,
}: {
  icon: typeof Info;
  tone?: 'muted' | 'primary' | 'success';
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm',
        tone === 'primary' && 'border-primary/30 bg-primary/5',
        tone === 'success' && 'border-secondary/20 bg-secondary/5',
        tone === 'muted' && 'bg-card text-muted-foreground',
      )}
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', tone === 'muted' ? 'text-muted-foreground' : 'text-primary')} />
      <div>{children}</div>
    </div>
  );
}

function WindowNotice({
  state,
  tournament,
  canManage,
  isAdmin,
}: {
  state: VerificationState;
  tournament: TournamentDetail;
  canManage: boolean;
  isAdmin: boolean;
}): React.ReactElement | null {
  const readOnly = isAdmin
    ? 'view only.'
    : 'view only. Approvals and rating changes are made by Admin and the Center Sevaks.';
  switch (state.kind) {
    case 'open':
      return (
        <Notice icon={ShieldCheck} tone="primary">
          <span className="font-semibold">Verification open</span> until{' '}
          {formatWhen(state.deadline, tournament.timezone)} —{' '}
          {canManage ? 'approve or decline waitlisted players and adjust ratings.' : readOnly}
        </Notice>
      );
    case 'complete':
      return (
        <Notice icon={CheckCircle2} tone="success">
          <span className="font-semibold">Verification complete.</span> Showing the confirmed roster.
        </Notice>
      );
    case 'closed':
      return (
        <Notice icon={Lock}>
          Verification closed on {formatWhen(state.deadline, tournament.timezone)} — changes are locked.
          {isAdmin ? null : ' Approvals are made by Admin and the Center Sevaks.'}
        </Notice>
      );
    default:
      return null;
  }
}

/** /tournaments/:id/registrations */
export function RegistrationsTab(): React.ReactElement {
  const { tournamentId = '' } = useParams();
  return <RegistrationsPanel tournamentId={tournamentId} />;
}

/** Registered players by status, with Admin verify actions (Club Manager: read-only). */
export function RegistrationsPanel({ tournamentId }: { tournamentId: string }): React.ReactElement {
  const { user } = useAuth();
  const isAdmin = user?.role === UserRole.Admin;
  const detail = useTournamentDetail(tournamentId);
  const tournament = detail.data;

  const preState = tournament ? resolveVerificationState(tournament, 1) : null;
  const listable = preState !== null && ['open', 'closed', 'complete'].includes(preState.kind);

  const queue = useVerificationQueue(tournamentId, listable && isAdmin);
  const registered = useRegisteredPlayers(tournamentId, listable && !isAdmin);
  const actions = useRegistrationActions(tournamentId);

  const rows = useMemo<RegistrationSummary[]>(() => {
    if (isAdmin) return queue.data?.registered ?? [];
    const view = registered.data;
    return view ? [...view.waitlist, ...view.confirmed, ...view.declined] : [];
  }, [isAdmin, queue.data, registered.data]);
  const canManage = isAdmin && queue.data?.canManage === true;
  const counts = useMemo(() => countByStatus(rows), [rows]);
  const centers = useMemo(() => registrationCenters(rows), [rows]);
  const state = tournament ? resolveVerificationState(tournament, counts[RegistrationStatus.InWaitlist]) : null;

  const active = isAdmin ? queue : registered;
  const loaded = active.isSuccess;

  const [chosenStatus, setChosenStatus] = useState<RegistrationStatus | null>(null);
  const [search, setSearch] = useState('');
  const [centerId, setCenterId] = useState(ALL_CENTERS);
  const status =
    chosenStatus ?? (loaded && state ? defaultRegistrationStatus(state) : RegistrationStatus.InWaitlist);
  const filters: RegistrationFilters = { status, search, centerId };

  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  const [ratingsRow, setRatingsRow] = useState<RegistrationSummary | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RatingDraft>(() => ratingDraftFrom(EMPTY_RATINGS));
  const [invalidField, setInvalidField] = useState<RatingKey | null>(null);
  const savingRatings = actions.updateRatings.isPending;
  // useMutation returns a fresh object each render; only `mutate` is stable enough for memo deps.
  const approve = actions.approve.mutate;
  const updateRatings = actions.updateRatings.mutate;

  const inlineEdit = useMemo<InlineRatingEdit | null>(
    () =>
      canManage
        ? {
            editingId,
            draft,
            invalidField,
            saving: savingRatings,
            onStart: (row) => {
              setEditingId(row.id);
              setDraft(ratingDraftFrom(row));
              setInvalidField(null);
            },
            onChange: (key, value) => {
              setDraft((current) => ({ ...current, [key]: value }));
              setInvalidField((current) => (current === key ? null : current));
            },
            onCancel: () => {
              setEditingId(null);
              setInvalidField(null);
            },
            onUpdate: (row) => {
              if (savingRatings) return;
              const parsed = parseRatingDraft(draft);
              if (!parsed.ok) {
                setInvalidField(parsed.field);
                toast.error(parsed.error);
                return;
              }
              updateRatings(
                { registrationId: row.id, body: parsed.body },
                {
                  onSuccess: () => {
                    setEditingId(null);
                    toast.success(`Ratings updated for ${fullName(row)}`);
                  },
                  onError: (err) => toast.error(errorMessage(err, 'Could not update ratings.')),
                },
              );
            },
          }
        : null,
    [canManage, updateRatings, editingId, draft, invalidField, savingRatings],
  );

  const rowActions = useMemo<RegistrationRowActions | undefined>(
    () =>
      canManage
        ? {
            busyId,
            onApprove: (row) => {
              setBusyId(row.id);
              approve(row.id, {
                onSuccess: () => toast.success(`${fullName(row)} confirmed`),
                onError: (err) => toast.error(errorMessage(err, 'Could not approve player.')),
                onSettled: () => setBusyId(null),
              });
            },
            onDecline: (row) => setConfirm({ kind: 'decline', row }),
            onRevert: (row) => setConfirm({ kind: 'revert', row }),
            onEditRatings: setRatingsRow,
          }
        : undefined,
    [canManage, busyId, approve],
  );
  const columns = useMemo(() => buildRegistrationColumns(rowActions), [rowActions]);
  const visibleRows = useMemo(
    () => filterRegistrations(rows, { status, search, centerId }),
    [rows, status, search, centerId],
  );

  const runConfirm = async (pending: PendingConfirm) => {
    if (pending.kind === 'decline') {
      await actions.decline.mutateAsync(pending.row.id);
      toast.success(`${fullName(pending.row)} declined`);
    } else {
      await actions.revert.mutateAsync(pending.row.id);
      toast.success(`${fullName(pending.row)} moved back to the waitlist`);
    }
  };

  const saveRatings = async (row: RegistrationSummary, body: UpdateRatingsRequest) => {
    await actions.updateRatings.mutateAsync({ registrationId: row.id, body });
    toast.success(`Ratings updated for ${fullName(row)}`);
  };

  if (detail.isError) {
    return <QueryErrorCard title="Couldn't load this tournament" error={detail.error} onRetry={() => void detail.refetch()} />;
  }
  if (!tournament || !state) {
    return <div className="h-40 animate-pulse rounded-lg bg-muted" />;
  }
  if (state.kind === 'leather') {
    return (
      <Notice icon={Info}>
        Leather-ball (ACC) registrations are confirmed automatically — there is no verification step.
      </Notice>
    );
  }
  if (state.kind === 'no-window') {
    return <Notice icon={Info}>This tournament has no registration window, so there is nothing to verify.</Notice>;
  }
  if (state.kind === 'not-open') {
    return (
      <Notice icon={Info}>
        Registration opens {formatWhen(state.opensAt, tournament.timezone)}. Registered players appear here once it
        opens.
      </Notice>
    );
  }

  return (
    <div className="space-y-4">
      {loaded ? <WindowNotice state={state} tournament={tournament} canManage={canManage} isAdmin={isAdmin} /> : null}

      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          ariaLabel="Registration status"
          value={status}
          options={REGISTRATION_STATUS_TABS.map((tab) => ({
            value: tab.value,
            label: loaded ? `${tab.label} (${counts[tab.value]})` : tab.label,
          }))}
          onChange={setChosenStatus}
        />
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or mobile"
            className="pl-9"
            aria-label="Search registered players"
          />
        </div>
        <Select value={centerId} onValueChange={setCenterId}>
          <SelectTrigger className="w-[200px]" aria-label="Center">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CENTERS}>All centers</SelectItem>
            {centers.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => void active.refetch()} disabled={active.isFetching}>
          <RefreshCw className={active.isFetching ? 'animate-spin' : undefined} />
          Refresh
        </Button>
      </div>

      {active.isError ? (
        <QueryErrorCard
          title="Couldn't load registered players"
          error={active.error}
          onRetry={() => void active.refetch()}
        />
      ) : (
        <InlineRatingEditContext.Provider value={inlineEdit}>
          <DataTable
            columns={columns}
            data={visibleRows}
            isLoading={active.isPending}
            getRowId={(row) => row.id}
            initialSorting={[{ id: 'name', desc: false }]}
            resetPageKey={JSON.stringify(filters)}
            emptyState={
              rows.length === 0
                ? 'No players have registered yet.'
                : `No ${REGISTRATION_STATUS_TABS.find((t) => t.value === filters.status)?.label.toLowerCase()} players match.`
            }
          />
        </InlineRatingEditContext.Provider>
      )}

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title={confirm?.kind === 'revert' ? 'Move back to waitlist?' : 'Decline registration?'}
        description={
          confirm
            ? confirm.kind === 'revert'
              ? `Move ${fullName(confirm.row)} back to the waitlist so they can be verified again?`
              : `Mark ${fullName(confirm.row)} as declined for this tournament? They'll be told to contact their Center Sevak.`
            : ''
        }
        confirmLabel={confirm?.kind === 'revert' ? 'Move to waitlist' : 'Decline'}
        destructive={confirm?.kind === 'decline'}
        onConfirm={() => (confirm ? runConfirm(confirm) : Promise.resolve())}
      />

      <RatingsDialog
        row={ratingsRow}
        onOpenChange={(open) => {
          if (!open) setRatingsRow(null);
        }}
        onSave={saveRatings}
      />
    </div>
  );
}
