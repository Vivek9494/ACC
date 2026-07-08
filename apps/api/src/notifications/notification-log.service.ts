import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

export interface NotificationLogReservation {
  triggerKey: string;
  dedupeKey?: string | null;
  title: string;
  body: string;
  data?: Record<string, string> | null;
  audienceSummary?: string | null;
}

export interface NotificationLogCounts {
  recipientCount: number;
  successCount: number;
  failureCount: number;
}

/**
 * Writes the §17 notification send log and enforces de-duplication via the
 * unique `dedupeKey`. The service reserves the log row *before* dispatch so a
 * timed job that fires twice (or a retry) short-circuits on the second call —
 * the row already exists — instead of double-sending.
 */
@Injectable()
export class NotificationLogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Reserve a log row up front (recipient/success/failure start at 0). Returns
   * the row id, or `null` when a row with the same `dedupeKey` already exists
   * (i.e. this logical notification was already sent).
   */
  async reserve(entry: NotificationLogReservation): Promise<string | null> {
    try {
      const row = await this.prisma.notificationLog.create({
        data: {
          triggerKey: entry.triggerKey,
          dedupeKey: entry.dedupeKey ?? null,
          title: entry.title,
          body: entry.body,
          data: (entry.data ?? undefined) as Prisma.InputJsonValue | undefined,
          recipientCount: 0,
          successCount: 0,
          failureCount: 0,
          audienceSummary: entry.audienceSummary ?? null,
        },
        select: { id: true },
      });
      return row.id;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' // unique constraint on dedupeKey
      ) {
        return null;
      }
      throw err;
    }
  }

  /** Fill in delivery counts after dispatch completes. */
  async finalize(id: string, counts: NotificationLogCounts): Promise<void> {
    await this.prisma.notificationLog.update({
      where: { id },
      data: counts,
    });
  }
}
