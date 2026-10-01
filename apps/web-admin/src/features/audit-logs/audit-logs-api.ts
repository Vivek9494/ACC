import type { AuditLogFilterOptions, AuditLogPage, ListAuditLogsParams } from '@acc/types';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api-client';

import { toAuditLogSearch } from './audit-logs';

export const auditLogKeys = {
  all: ['admin-audit-logs'] as const,
  page: (params: ListAuditLogsParams) => ['admin-audit-logs', 'page', params] as const,
  filters: (from: string, to: string) => ['admin-audit-logs', 'filters', from, to] as const,
};

/** GET /admin/audit-logs — Admin only (VIEW_AUDIT_LOG). */
export function useAuditLogs(params: ListAuditLogsParams) {
  return useQuery({
    queryKey: auditLogKeys.page(params),
    queryFn: ({ signal }) =>
      apiFetch<AuditLogPage>(`/admin/audit-logs?${toAuditLogSearch(params)}`, { signal }),
    placeholderData: keepPreviousData,
  });
}

/** GET /admin/audit-logs/filters — actors / actions / entity types present in the window. */
export function useAuditLogFilterOptions(range: { from: string; to: string }) {
  return useQuery({
    queryKey: auditLogKeys.filters(range.from, range.to),
    queryFn: ({ signal }) =>
      apiFetch<AuditLogFilterOptions>(
        `/admin/audit-logs/filters?${new URLSearchParams({ from: range.from, to: range.to })}`,
        { signal },
      ),
    placeholderData: keepPreviousData,
  });
}
