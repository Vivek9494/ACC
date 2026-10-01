import { ADMIN_USER_ROLE_LABELS, auditActionLabel, auditEntityTypeLabel, type AuditLogEntryView } from '@acc/types';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { auditFieldChanges, formatAuditTimestamp, formatAuditValue } from './audit-logs';

function Row({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

export function AuditLogDetailsDialog({
  entry,
  onClose,
}: {
  entry: AuditLogEntryView | null;
  onClose: () => void;
}): React.ReactElement {
  const changes = entry ? auditFieldChanges(entry.before, entry.after) : [];
  const detailEntries =
    entry?.details && typeof entry.details === 'object' && !Array.isArray(entry.details)
      ? Object.entries(entry.details)
      : [];
  const when = entry ? formatAuditTimestamp(entry.createdAt) : null;

  return (
    <Dialog open={entry !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        {entry ? (
          <>
            <DialogHeader>
              <DialogTitle>{auditActionLabel(entry.action)}</DialogTitle>
              <DialogDescription className="font-mono text-xs">{entry.action}</DialogDescription>
            </DialogHeader>

            <dl className="grid gap-2">
              <Row label="When">
                {when?.date} · {when?.time}
              </Row>
              <Row label="Actor">
                {entry.actor.name}
                {entry.actor.role ? ` (${ADMIN_USER_ROLE_LABELS[entry.actor.role]})` : ''}
              </Row>
              <Row label="Entity">
                {auditEntityTypeLabel(entry.entity.type)}
                {entry.entity.name ? ` · ${entry.entity.name}` : ''}
                {entry.entity.id ? (
                  <span className="block font-mono text-xs text-muted-foreground">{entry.entity.id}</span>
                ) : null}
              </Row>
              {entry.targetUser ? <Row label="User">{entry.targetUser.name}</Row> : null}
            </dl>

            {changes.length > 0 ? (
              <section className="grid gap-2">
                <h3 className="text-sm font-semibold">Changes</h3>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Field</th>
                        <th className="px-3 py-2 font-medium">Before</th>
                        <th className="px-3 py-2 font-medium">After</th>
                      </tr>
                    </thead>
                    <tbody>
                      {changes.map((change) => (
                        <tr key={change.key} className="border-t align-top">
                          <td className="px-3 py-2 font-mono text-xs">{change.key}</td>
                          <td className="px-3 py-2 break-all">{formatAuditValue(change.before)}</td>
                          <td className="px-3 py-2 break-all">{formatAuditValue(change.after)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            {detailEntries.length > 0 ? (
              <section className="grid gap-2">
                <h3 className="text-sm font-semibold">Details</h3>
                <dl className="grid gap-1.5 rounded-md border p-3">
                  {detailEntries.map(([key, value]) => (
                    <Row key={key} label={key}>
                      <span className="font-mono text-xs break-all">{formatAuditValue(value)}</span>
                    </Row>
                  ))}
                </dl>
              </section>
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
