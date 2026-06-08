import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

/**
 * One immutable audit entry (§18.2). `actorUserId` is omitted for System-actor
 * events, in which case `actorLabel` should be "System".
 */
interface AuditEntry {
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

/** Append-only audit-trail writer (§18). Entries are never updated or deleted. */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        action: entry.action,
        actorUserId: entry.actorUserId ?? null,
        actorLabel: entry.actorLabel ?? null,
        targetUserId: entry.targetUserId ?? null,
        targetEntityType: entry.targetEntityType ?? null,
        targetEntityId: entry.targetEntityId ?? null,
        before: entry.before,
        after: entry.after,
        details: entry.details,
      },
    });
  }
}
