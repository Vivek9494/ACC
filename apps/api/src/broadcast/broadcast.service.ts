import {
  BROADCAST_TTL_HOURS,
  BROADCAST_VALIDATION_MESSAGES,
  BroadcastDisplayStatus,
  deriveBroadcastDisplayStatus,
  type ActiveBroadcast,
  type AdminBroadcastView,
  type AuthUser,
  type BroadcastHistoryEntry,
  isValidBroadcastContent,
} from '@acc/types';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { NotificationAudienceService } from '../notifications/notification-audience.service';
import { NotificationsService, NotificationTrigger } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { MediaUrlResolver } from '../storage/media-url.resolver';

const BROADCAST_TTL_MS = BROADCAST_TTL_HOURS * 60 * 60 * 1000;

/** Max broadcast-text characters surfaced in the push body before truncation. */
const BROADCAST_SNIPPET_LENGTH = 140;

@Injectable()
export class BroadcastService {
  private readonly logger = new Logger(BroadcastService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaUrls: MediaUrlResolver,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly notificationAudience: NotificationAudienceService,
  ) {}

  async getActiveBroadcast(): Promise<ActiveBroadcast | null> {
    const row = await this.findActiveRow();
    return row ? this.toActiveView(row) : null;
  }

  async getAdminBroadcast(): Promise<AdminBroadcastView | null> {
    const row = await this.findActiveRowWithPoster();
    if (!row) {
      return null;
    }
    const active = await this.toActiveView(row);
    const remainingSeconds = this.remainingSeconds(row.expiresAt);
    return {
      ...active,
      postedByUserId: row.postedBy,
      postedByName: `${row.poster.firstName} ${row.poster.lastName}`.trim(),
      remainingSeconds,
    };
  }

  async listBroadcastHistory(): Promise<BroadcastHistoryEntry[]> {
    const rows = await this.prisma.broadcast.findMany({
      orderBy: { postedAt: 'desc' },
      include: {
        poster: { select: { firstName: true, lastName: true } },
      },
    });
    const now = new Date();
    return Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        imageUrl: await this.mediaUrls.resolveReadUrl(row.imageUrl),
        text: row.text,
        postedAt: row.postedAt.toISOString(),
        expiresAt: row.expiresAt.toISOString(),
        removedAt: row.removedAt?.toISOString() ?? null,
        postedByName: `${row.poster.firstName} ${row.poster.lastName}`.trim(),
        status: deriveBroadcastDisplayStatus({
          removedAt: row.removedAt,
          expiresAt: row.expiresAt,
          now,
        }),
      })),
    );
  }

  async createBroadcast(
    actor: AuthUser,
    text: string | undefined,
    imageStorageKey: string | undefined,
  ): Promise<ActiveBroadcast> {
    const trimmedText = text?.trim() ?? '';
    const hasImage = imageStorageKey != null && imageStorageKey.trim().length > 0;
    if (!isValidBroadcastContent(trimmedText, hasImage)) {
      throw new BadRequestException({
        message: BROADCAST_VALIDATION_MESSAGES.contentRequired,
        error: 'BROADCAST_CONTENT_REQUIRED',
        fields: { text: BROADCAST_VALIDATION_MESSAGES.contentRequired },
      });
    }

    const imageUrl = hasImage ? imageStorageKey!.trim() : null;

    const postedAt = new Date();
    const expiresAt = new Date(postedAt.getTime() + BROADCAST_TTL_MS);

    const created = await this.prisma.$transaction(async (tx) => {
      await tx.broadcast.updateMany({
        where: {
          removedAt: null,
          expiresAt: { gt: postedAt },
        },
        data: { removedAt: postedAt },
      });

      return tx.broadcast.create({
        data: {
          imageUrl,
          text: trimmedText.length > 0 ? trimmedText : null,
          postedBy: actor.id,
          postedAt,
          expiresAt,
        },
      });
    });

    await this.audit.record({
      action: 'BROADCAST_POSTED',
      actorUserId: actor.id,
      targetEntityType: 'broadcast',
      targetEntityId: created.id,
      after: {
        hasImage: imageUrl != null,
        hasText: trimmedText.length > 0,
        expiresAt: expiresAt.toISOString(),
      },
    });

    await this.notifyBroadcast(created.id, trimmedText);

    return this.toActiveView(created);
  }

  /**
   * §17 Phase B: push a newly published broadcast to every active user. Deduped
   * by broadcast id so a save retry never double-notifies. Best-effort — never
   * fails the publish.
   */
  private async notifyBroadcast(broadcastId: string, text: string): Promise<void> {
    try {
      const userIds = await this.notificationAudience.resolveAllActiveUsers();
      if (userIds.length === 0) {
        return;
      }
      await this.notifications.sendToAudience(userIds, {
        triggerKey: NotificationTrigger.BroadcastPosted,
        dedupeKey: `${NotificationTrigger.BroadcastPosted}:${broadcastId}`,
        title: 'Announcement',
        body: broadcastSnippet(text),
        data: { broadcastId, screen: 'dashboard' },
        audienceSummary: `Broadcast ${broadcastId} to all active users`,
      });
    } catch (err) {
      this.logger.error(`Failed to send broadcast notification for ${broadcastId}`, err as Error);
    }
  }

  async removeActiveBroadcast(actor: AuthUser): Promise<void> {
    const row = await this.findActiveRow();
    if (!row) {
      throw new NotFoundException({
        message: 'No active broadcast to remove',
        error: 'BROADCAST_NOT_ACTIVE',
      });
    }

    const removedAt = new Date();
    await this.prisma.broadcast.update({
      where: { id: row.id },
      data: { removedAt },
    });

    await this.audit.record({
      action: 'BROADCAST_REMOVED',
      actorUserId: actor.id,
      targetEntityType: 'broadcast',
      targetEntityId: row.id,
      before: {
        hasImage: row.imageUrl != null,
        hasText: row.text != null && row.text.length > 0,
      },
      after: { removedAt: removedAt.toISOString() },
    });
  }

  private async findActiveRow() {
    const now = new Date();
    return this.prisma.broadcast.findFirst({
      where: {
        removedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { postedAt: 'desc' },
    });
  }

  private async findActiveRowWithPoster() {
    const now = new Date();
    return this.prisma.broadcast.findFirst({
      where: {
        removedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { postedAt: 'desc' },
      include: { poster: true },
    });
  }

  private async toActiveView(row: {
    id: string;
    imageUrl: string | null;
    text: string | null;
    postedAt: Date;
    expiresAt: Date;
  }): Promise<ActiveBroadcast> {
    const imageUrl = await this.mediaUrls.resolveReadUrl(row.imageUrl);
    return {
      id: row.id,
      imageUrl,
      text: row.text,
      postedAt: row.postedAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
    };
  }

  private remainingSeconds(expiresAt: Date): number {
    return Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  }
}

/** Push-body snippet for a broadcast: trimmed text, or a fallback for image-only. */
function broadcastSnippet(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return 'A new announcement is available. Tap to view.';
  }
  if (trimmed.length <= BROADCAST_SNIPPET_LENGTH) {
    return trimmed;
  }
  return `${trimmed.slice(0, BROADCAST_SNIPPET_LENGTH - 1).trimEnd()}…`;
}
