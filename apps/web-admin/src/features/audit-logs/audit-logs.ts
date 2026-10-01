import {
  AUDIT_LOG_MAX_RANGE_DAYS,
  AUDIT_LOG_RETENTION_DAYS,
  type AuditJsonValue,
  type ListAuditLogsParams,
} from '@acc/types';

/** Local calendar day ("YYYY-MM-DD") in the browser's timezone. */
export type LocalIsoDate = string;

export type LogsDateSelection =
  | { mode: 'day'; date: LocalIsoDate }
  | { mode: 'range'; fromDate: LocalIsoDate; toDate: LocalIsoDate };

export interface LogsFilters {
  actorUserId: string | null;
  action: string | null;
  entityType: string | null;
}

export const EMPTY_LOGS_FILTERS: LogsFilters = { actorUserId: null, action: null, entityType: null };

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function toLocalIsoDate(date: Date): LocalIsoDate {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseLocalIsoDate(value: LocalIsoDate): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

export function shiftLocalIsoDate(value: LocalIsoDate, days: number): LocalIsoDate {
  const date = parseLocalIsoDate(value);
  date.setDate(date.getDate() + days);
  return toLocalIsoDate(date);
}

/** Oldest day that can still hold entries after the daily retention purge. */
export function oldestRetainedDate(now: Date = new Date()): LocalIsoDate {
  return shiftLocalIsoDate(toLocalIsoDate(now), -AUDIT_LOG_RETENTION_DAYS);
}

export function defaultLogsSelection(now: Date = new Date()): LogsDateSelection {
  return { mode: 'day', date: toLocalIsoDate(now) };
}

export function selectionBounds(selection: LogsDateSelection): { fromDate: LocalIsoDate; toDate: LocalIsoDate } {
  return selection.mode === 'day'
    ? { fromDate: selection.date, toDate: selection.date }
    : { fromDate: selection.fromDate, toDate: selection.toDate };
}

/** Whole local days between two dates, inclusive. */
export function inclusiveDaySpan(fromDate: LocalIsoDate, toDate: LocalIsoDate): number {
  const ms = parseLocalIsoDate(toDate).getTime() - parseLocalIsoDate(fromDate).getTime();
  return Math.round(ms / 86_400_000) + 1;
}

export function validateLogsRange(fromDate: LocalIsoDate, toDate: LocalIsoDate): string | null {
  if (!fromDate || !toDate) {
    return 'Pick both a start and an end date.';
  }
  if (fromDate > toDate) {
    return 'The start date must be on or before the end date.';
  }
  if (inclusiveDaySpan(fromDate, toDate) > AUDIT_LOG_MAX_RANGE_DAYS) {
    return `Pick a range of ${AUDIT_LOG_MAX_RANGE_DAYS} days or fewer.`;
  }
  return null;
}

/**
 * The selected local days as a UTC instant window: `from` = local midnight of
 * the first day (inclusive), `to` = local midnight after the last day (exclusive).
 */
export function selectionToUtcWindow(selection: LogsDateSelection): { from: string; to: string } {
  const { fromDate, toDate } = selectionBounds(selection);
  const from = parseLocalIsoDate(fromDate);
  const to = parseLocalIsoDate(shiftLocalIsoDate(toDate, 1));
  return { from: from.toISOString(), to: to.toISOString() };
}

export function toAuditLogParams(
  selection: LogsDateSelection,
  filters: LogsFilters,
  pageIndex: number,
  pageSize: number,
): ListAuditLogsParams {
  return {
    ...selectionToUtcWindow(selection),
    ...(filters.actorUserId ? { actorUserId: filters.actorUserId } : {}),
    ...(filters.action ? { action: filters.action } : {}),
    ...(filters.entityType ? { entityType: filters.entityType } : {}),
    page: pageIndex + 1,
    pageSize,
  };
}

export function toAuditLogSearch(params: ListAuditLogsParams): URLSearchParams {
  const search = new URLSearchParams({ from: params.from, to: params.to });
  if (params.actorUserId) search.set('actorUserId', params.actorUserId);
  if (params.action) search.set('action', params.action);
  if (params.entityType) search.set('entityType', params.entityType);
  if (params.page) search.set('page', String(params.page));
  if (params.pageSize) search.set('pageSize', String(params.pageSize));
  return search;
}

export function hasActiveLogsFilters(filters: LogsFilters): boolean {
  return filters.actorUserId !== null || filters.action !== null || filters.entityType !== null;
}

export function formatAuditTimestamp(iso: string): { date: string; time: string } {
  const value = new Date(iso);
  return {
    date: value.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
    time: value.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' }),
  };
}

export function formatSelectionLabel(selection: LogsDateSelection): string {
  const format = (value: LocalIsoDate) =>
    parseLocalIsoDate(value).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  const { fromDate, toDate } = selectionBounds(selection);
  return fromDate === toDate ? format(fromDate) : `${format(fromDate)} – ${format(toDate)}`;
}

export interface AuditFieldChange {
  key: string;
  before: AuditJsonValue | undefined;
  after: AuditJsonValue | undefined;
}

function isJsonObject(value: AuditJsonValue | null | undefined): value is { [key: string]: AuditJsonValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Field-by-field before → after rows when both sides are objects; empty otherwise. */
export function auditFieldChanges(
  before: AuditJsonValue | null,
  after: AuditJsonValue | null,
): AuditFieldChange[] {
  const beforeObj = isJsonObject(before) ? before : null;
  const afterObj = isJsonObject(after) ? after : null;
  if (!beforeObj && !afterObj) return [];
  const keys = [...new Set([...Object.keys(beforeObj ?? {}), ...Object.keys(afterObj ?? {})])];
  return keys.map((key) => ({ key, before: beforeObj?.[key], after: afterObj?.[key] }));
}

export function formatAuditValue(value: AuditJsonValue | undefined): string {
  if (value === undefined) return '—';
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

/** One-line summary of `details` for the table cell. */
export function summarizeAuditDetails(details: AuditJsonValue | null, maxEntries = 3): string {
  if (!isJsonObject(details)) {
    return details === null ? '' : formatAuditValue(details);
  }
  const entries = Object.entries(details);
  const shown = entries.slice(0, maxEntries).map(([key, value]) => `${key}: ${formatAuditValue(value)}`);
  const extra = entries.length - shown.length;
  return extra > 0 ? `${shown.join(' · ')} · +${extra} more` : shown.join(' · ');
}
