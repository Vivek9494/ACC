import {
  AUDIT_LOG_MAX_RANGE_DAYS,
  AUDIT_LOG_PAGE_SIZE,
  AUDIT_LOG_RETENTION_DAYS,
  AUDIT_SYSTEM_ACTOR_LABEL,
  auditActionLabel,
  auditEntityTypeLabel,
  type AuditLogEntryView,
} from '@acc/types';
import { ChevronLeft, ChevronRight, Info, RefreshCw, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import { DataTable } from '@/components/data-table/DataTable';
import { PageHeader } from '@/components/layout/PageHeader';
import { QueryErrorCard } from '@/components/QueryErrorCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { AuditLogDetailsDialog } from './AuditLogDetailsDialog';
import {
  defaultLogsSelection,
  EMPTY_LOGS_FILTERS,
  formatSelectionLabel,
  hasActiveLogsFilters,
  oldestRetainedDate,
  selectionBounds,
  selectionToUtcWindow,
  shiftLocalIsoDate,
  toAuditLogParams,
  toLocalIsoDate,
  validateLogsRange,
  type LogsDateSelection,
  type LogsFilters,
} from './audit-logs';
import { useAuditLogFilterOptions, useAuditLogs } from './audit-logs-api';
import { buildAuditLogColumns } from './columns';

const ALL = '__all__';

type DateMode = LogsDateSelection['mode'];

const DATE_MODES = [
  { value: 'day', label: 'Single day' },
  { value: 'range', label: 'Date range' },
] as const;

/** Admin-only audit log: who did what, when. */
export function LogsPage(): React.ReactElement {
  const today = toLocalIsoDate(new Date());
  const minDate = oldestRetainedDate();

  const [selection, setSelection] = useState<LogsDateSelection>(() => defaultLogsSelection());
  const [draftRange, setDraftRange] = useState(() => ({ fromDate: shiftLocalIsoDate(today, -6), toDate: today }));
  const [filters, setFilters] = useState<LogsFilters>(EMPTY_LOGS_FILTERS);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState<number>(AUDIT_LOG_PAGE_SIZE);
  const [openEntry, setOpenEntry] = useState<AuditLogEntryView | null>(null);

  const rangeError = selection.mode === 'range' ? validateLogsRange(draftRange.fromDate, draftRange.toDate) : null;

  const utcWindow = useMemo(() => selectionToUtcWindow(selection), [selection]);
  const params = useMemo(
    () => toAuditLogParams(selection, filters, pageIndex, pageSize),
    [selection, filters, pageIndex, pageSize],
  );
  const query = useAuditLogs(params);
  const filterOptions = useAuditLogFilterOptions(utcWindow);
  const columns = useMemo(() => buildAuditLogColumns(), []);

  const page = query.data;
  const totalCount = page?.totalCount ?? 0;
  const isFiltered = hasActiveLogsFilters(filters);

  const applySelection = (next: LogsDateSelection) => {
    setSelection(next);
    setPageIndex(0);
  };

  const updateFilters = (patch: Partial<LogsFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPageIndex(0);
  };

  const changeMode = (mode: DateMode) => {
    if (mode === selection.mode) return;
    if (mode === 'day') {
      applySelection({ mode: 'day', date: selectionBounds(selection).toDate });
      return;
    }
    const day = selection.mode === 'day' ? selection.date : today;
    const weekBefore = shiftLocalIsoDate(day, -6);
    const next = { fromDate: weekBefore < minDate ? minDate : weekBefore, toDate: day };
    setDraftRange(next);
    applySelection({ mode: 'range', ...next });
  };

  const updateDraftRange = (patch: Partial<typeof draftRange>) => {
    const next = { ...draftRange, ...patch };
    setDraftRange(next);
    if (validateLogsRange(next.fromDate, next.toDate) === null) {
      applySelection({ mode: 'range', ...next });
    }
  };

  const actors = filterOptions.data?.actors ?? [];
  const actions = filterOptions.data?.actions ?? [];
  const entityTypes = filterOptions.data?.entityTypes ?? [];

  return (
    <div>
      <PageHeader
        title="Logs"
        description="Audit log of who did what, and when, across the platform."
        actions={
          <Button variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}>
            <RefreshCw className={query.isFetching ? 'animate-spin' : undefined} />
            Refresh
          </Button>
        }
      />

      <p className="mb-5 flex items-center gap-2 rounded-md border border-secondary/20 bg-secondary/5 px-3 py-2 text-sm text-secondary">
        <Info className="size-4 shrink-0" />
        Entries are kept for {AUDIT_LOG_RETENTION_DAYS} days, then removed by a daily cleanup. Secrets (passwords,
        tokens, OTP codes) are never recorded.
      </p>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <SegmentedControl ariaLabel="Date selection" value={selection.mode} options={DATE_MODES} onChange={changeMode} />

        {selection.mode === 'day' ? (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous day"
              disabled={selection.date <= minDate}
              onClick={() => applySelection({ mode: 'day', date: shiftLocalIsoDate(selection.date, -1) })}
            >
              <ChevronLeft />
            </Button>
            <Input
              type="date"
              aria-label="Date"
              className="w-[160px]"
              value={selection.date}
              min={minDate}
              max={today}
              onChange={(e) => e.target.value && applySelection({ mode: 'day', date: e.target.value })}
            />
            <Button
              variant="outline"
              size="icon"
              aria-label="Next day"
              disabled={selection.date >= today}
              onClick={() => applySelection({ mode: 'day', date: shiftLocalIsoDate(selection.date, 1) })}
            >
              <ChevronRight />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              aria-label="From date"
              className="w-[160px]"
              value={draftRange.fromDate}
              min={minDate}
              max={today}
              onChange={(e) => updateDraftRange({ fromDate: e.target.value })}
            />
            <span className="text-sm text-muted-foreground">to</span>
            <Input
              type="date"
              aria-label="To date"
              className="w-[160px]"
              value={draftRange.toDate}
              min={minDate}
              max={today}
              onChange={(e) => updateDraftRange({ toDate: e.target.value })}
            />
          </div>
        )}
      </div>

      {rangeError ? (
        <p className="mb-4 text-sm text-destructive" role="alert">
          {rangeError} Showing {formatSelectionLabel(selection)}.
        </p>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select
          value={filters.actorUserId ?? ALL}
          onValueChange={(v) => updateFilters({ actorUserId: v === ALL ? null : v })}
        >
          <SelectTrigger className="w-[220px]" aria-label="Actor">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All actors</SelectItem>
            {actors.map((actor) => (
              <SelectItem key={actor.userId ?? AUDIT_SYSTEM_ACTOR_LABEL} value={actor.userId ?? AUDIT_SYSTEM_ACTOR_LABEL}>
                {actor.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.action ?? ALL} onValueChange={(v) => updateFilters({ action: v === ALL ? null : v })}>
          <SelectTrigger className="w-[240px]" aria-label="Action">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All actions</SelectItem>
            {actions.map((action) => (
              <SelectItem key={action} value={action}>
                {auditActionLabel(action)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.entityType ?? ALL}
          onValueChange={(v) => updateFilters({ entityType: v === ALL ? null : v })}
        >
          <SelectTrigger className="w-[200px]" aria-label="Entity type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All entity types</SelectItem>
            {entityTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {auditEntityTypeLabel(type)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isFiltered ? (
          <Button variant="ghost" onClick={() => updateFilters(EMPTY_LOGS_FILTERS)}>
            <X />
            Clear filters
          </Button>
        ) : null}
        <span className="ml-auto text-sm text-muted-foreground">
          {formatSelectionLabel(selection)}
          {page ? ` · ${totalCount} ${totalCount === 1 ? 'entry' : 'entries'}` : ''}
        </span>
      </div>

      {query.isError && !page ? (
        <QueryErrorCard title="Couldn't load logs" error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={page?.items ?? []}
          isLoading={query.isPending}
          getRowId={(entry) => entry.id}
          onRowClick={setOpenEntry}
          emptyState={
            isFiltered
              ? 'No log entries match these filters for the selected dates.'
              : `No activity was logged for the selected dates (max ${AUDIT_LOG_MAX_RANGE_DAYS} days per search).`
          }
          serverPagination={{
            pageIndex,
            pageSize,
            totalCount,
            hasNextPage: (pageIndex + 1) * pageSize < totalCount,
            onNextPage: () => setPageIndex((i) => i + 1),
            onPreviousPage: () => setPageIndex((i) => Math.max(0, i - 1)),
            onPageSizeChange: (size) => {
              setPageSize(size);
              setPageIndex(0);
            },
            isFetching: query.isFetching,
          }}
        />
      )}

      <AuditLogDetailsDialog entry={openEntry} onClose={() => setOpenEntry(null)} />
    </div>
  );
}
