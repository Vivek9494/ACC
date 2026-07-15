import { PushPlatform } from '@acc/types';
import { Injectable, Logger } from '@nestjs/common';
import type { PushPlatform as PrismaPushPlatform } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { selectableUserWhere } from '../users/user-query';
import { ApnsFcmTokenConverter } from './apns-fcm-token.converter';

/**
 * Manages FCM device-token registrations (§17). Tokens are unique per device;
 * re-registering the same token re-points it at the current user and refreshes
 * liveness. Invalid tokens are pruned by the notification service on send.
 *
 * iOS: expo-notifications supplies an APNs device token; we convert it to an
 * FCM registration token before persisting so Admin messaging can deliver.
 */
@Injectable()
export class PushTokenService {
  private readonly logger = new Logger(PushTokenService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly apnsFcm: ApnsFcmTokenConverter,
  ) {}

  /** Upsert a device token for a user (called on login / app start). */
  async register(userId: string, token: string, platform: PushPlatform): Promise<void> {
    const storedToken = await this.resolveFcmToken(token, platform);
    if (!storedToken) {
      return;
    }

    await this.prisma.pushDeviceToken.upsert({
      where: { token: storedToken },
      create: { userId, token: storedToken, platform },
      update: { userId, platform, lastSeenAt: new Date() },
    });

    // Drop a stale APNs row if we upgraded this device to an FCM token.
    if (storedToken !== token) {
      await this.prisma.pushDeviceToken.deleteMany({ where: { token } });
    }
  }

  /** Remove a device token (called on logout). No-op if it doesn't exist. */
  async unregister(token: string): Promise<void> {
    await this.prisma.pushDeviceToken.deleteMany({ where: { token } });

    // Client may still send the raw APNs token while DB stores the FCM form.
    if (this.apnsFcm.looksLikeApnsToken(token)) {
      const fcmToken = await this.apnsFcm.toFcmRegistrationToken(token);
      if (fcmToken) {
        await this.prisma.pushDeviceToken.deleteMany({ where: { token: fcmToken } });
      }
    }
  }

  /**
   * Resolve the active device tokens for a set of users. Only tokens belonging
   * to selectable (active, non-deleted) users are returned, so a deactivated
   * account never receives push even if a stale row lingers.
   *
   * Leftover APNs rows (pre-conversion) are upgraded in place when possible.
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
      select: { id: true, userId: true, token: true, platform: true },
    });

    const fcmTokens: string[] = [];
    for (const row of rows) {
      const resolved = await this.resolveFcmToken(row.token, row.platform as PushPlatform);
      if (!resolved) {
        continue;
      }
      if (resolved !== row.token) {
        await this.replaceTokenRow(row.id, row.userId, row.token, resolved, row.platform);
      }
      fcmTokens.push(resolved);
    }
    return [...new Set(fcmTokens)];
  }

  /** Delete tokens FCM reported as permanently invalid. */
  async pruneTokens(tokens: string[]): Promise<void> {
    if (tokens.length === 0) {
      return;
    }
    await this.prisma.pushDeviceToken.deleteMany({ where: { token: { in: tokens } } });
  }

  private async resolveFcmToken(
    token: string,
    platform: PushPlatform,
  ): Promise<string | null> {
    if (platform !== PushPlatform.Ios || !this.apnsFcm.looksLikeApnsToken(token)) {
      return token;
    }

    const fcmToken = await this.apnsFcm.toFcmRegistrationToken(token);
    if (!fcmToken) {
      this.logger.warn('Skipping iOS device token: APNs→FCM conversion failed');
      return null;
    }
    return fcmToken;
  }

  private async replaceTokenRow(
    id: string,
    userId: string,
    oldToken: string,
    newToken: string,
    platform: PrismaPushPlatform,
  ): Promise<void> {
    try {
      await this.prisma.$transaction([
        this.prisma.pushDeviceToken.delete({ where: { id } }),
        this.prisma.pushDeviceToken.upsert({
          where: { token: newToken },
          create: { userId, token: newToken, platform },
          update: { userId, platform, lastSeenAt: new Date() },
        }),
      ]);
    } catch (err) {
      this.logger.warn(
        `Failed to replace APNs token with FCM token for user ${userId}: ${(err as Error).message}`,
      );
      // Ensure we do not keep sending with the dead APNs token.
      await this.prisma.pushDeviceToken.deleteMany({ where: { token: oldToken } });
    }
  }
}
