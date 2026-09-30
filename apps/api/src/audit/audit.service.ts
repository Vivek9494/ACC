import { AUDIT_SYSTEM_ACTOR_LABEL } from '@acc/types';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { redactAuditPayload } from './audit-redaction';

/**
 * One audit entry (§18.2). `actorUserId` is omitted for System-actor events,
 * in which case `actorLabel` should be "System".
 */
export interface AuditEntry {
  action: string;
  actorUserId?: string;
  actorLabel?: string;
  targetUserId?: string;
  targetEntityType?: string;
  targetEntityId?: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  details?: Prisma.InputJsonValue;
}

/**
 * Audit-trail writer (§18). Entries are never updated; the daily retention job
 * deletes entries older than `AUDIT_LOG_RETENTION_DAYS`. Secret-named keys in
 * `before` / `after` / `details` are redacted before the write.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Pass `tx` to commit the entry atomically with the change it describes. */
  async record(entry: AuditEntry, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    await client.auditLog.create({
      data: {
        action: entry.action,
        actorUserId: entry.actorUserId ?? null,
        actorLabel: entry.actorLabel ?? (entry.actorUserId ? null : AUDIT_SYSTEM_ACTOR_LABEL),
        targetUserId: entry.targetUserId ?? null,
        targetEntityType: entry.targetEntityType?.toLowerCase() ?? null,
        targetEntityId: entry.targetEntityId ?? null,
        before: redactAuditPayload(entry.before),
        after: redactAuditPayload(entry.after),
        details: redactAuditPayload(entry.details),
      },
    });
  }
}
