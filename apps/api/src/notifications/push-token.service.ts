import type { PushPlatform } from '@acc/types';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { selectableUserWhere } from '../users/user-query';

/**
 * Manages FCM device-token registrations (§17). Tokens are unique per device;
 * re-registering the same token re-points it at the current user and refreshes
 * liveness. Invalid tokens are pruned by the notification service on send.
 */
@Injectable()
export class PushTokenService {
  constructor(private readonly prisma: PrismaService) {}

  /** Upsert a device token for a user (called on login / app start). */
  async register(userId: string, token: string, platform: PushPlatform): Promise<void> {
    await this.prisma.pushDeviceToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform, lastSeenAt: new Date() },
    });
  }

  /** Remove a device token (called on logout). No-op if it doesn't exist. */
  async unregister(token: string): Promise<void> {
    await this.prisma.pushDeviceToken.deleteMany({ where: { token } });
  }

  /**
   * Resolve the active device tokens for a set of users. Only tokens belonging
   * to selectable (active, non-deleted) users are returned, so a deactivated
   * account never receives push even if a stale row lingers.
   */
  async getTokensForUsers(userIds: string[]): Promise<string[]> {
    if (userIds.length === 0) {
      return [];
    }
    const rows = await this.prisma.pushDeviceToken.findMany({
      where: {
        userId: { in: [...new Set(userIds)] },
        user: { is: selectableUserWhere },
      },
      select: { token: true },
    });
    return rows.map((row) => row.token);
  }

  /** Delete tokens FCM reported as permanently invalid. */
  async pruneTokens(tokens: string[]): Promise<void> {
    if (tokens.length === 0) {
      return;
    }
    await this.prisma.pushDeviceToken.deleteMany({ where: { token: { in: tokens } } });
  }
}
