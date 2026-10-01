import { ADMIN_USER_ROLE_LABELS, auditActionLabel, auditEntityTypeLabel, type AuditLogEntryView } from '@acc/types';
import type { ColumnDef } from '@tanstack/react-table';
import { Bot } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

import { formatAuditTimestamp, summarizeAuditDetails } from './audit-logs';

export function buildAuditLogColumns(): ColumnDef<AuditLogEntryView>[] {
  return [
    {
      id: 'createdAt',
      header: 'Time',
      meta: { headerClassName: 'w-[150px]' },
      cell: ({ row }) => {
        const { date, time } = formatAuditTimestamp(row.original.createdAt);
        return (
          <div className="whitespace-nowrap">
            <div className="font-medium">{time}</div>
            <div className="text-xs text-muted-foreground">{date}</div>
          </div>
        );
      },
    },
    {
      id: 'actor',
      header: 'Actor',
      cell: ({ row }) => {
        const { actor } = row.original;
        if (actor.userId === null) {
          return (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Bot className="size-4" />
              {actor.name}
            </span>
          );
        }
        return (
          <div>
            <div className="font-medium">{actor.name}</div>
            {actor.role ? (
              <div className="text-xs text-muted-foreground">{ADMIN_USER_ROLE_LABELS[actor.role]}</div>
            ) : null}
          </div>
        );
      },
    },
    {
      id: 'action',
      header: 'Action',
      cell: ({ row }) => (
        <Badge variant="outline" className="font-medium whitespace-nowrap" title={row.original.action}>
          {auditActionLabel(row.original.action)}
        </Badge>
      ),
    },
    {
      id: 'entity',
      header: 'Entity',
      cell: ({ row }) => {
        const { entity, targetUser } = row.original;
        return (
          <div className="max-w-[260px]">
            <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {auditEntityTypeLabel(entity.type)}
            </div>
            <div className="truncate" title={entity.name ?? entity.id ?? undefined}>
              {entity.name ?? <span className="font-mono text-xs">{entity.id ?? '—'}</span>}
            </div>
            {targetUser ? <div className="text-xs text-muted-foreground">User: {targetUser.name}</div> : null}
          </div>
        );
      },
    },
    {
      id: 'details',
      header: 'Details',
      meta: { cellClassName: 'max-w-[360px]' },
      cell: ({ row }) => {
        const summary = summarizeAuditDetails(row.original.details);
        const hasDiff = row.original.before !== null || row.original.after !== null;
        return (
          <div className="flex items-center gap-2">
            <span className="truncate text-sm text-muted-foreground" title={summary}>
              {summary || (hasDiff ? 'Field changes' : '—')}
            </span>
          </div>
        );
      },
    },
  ];
}
