import 'reflect-metadata';

import { BROADCAST_VALIDATION_MESSAGES, type AuthUser, UserRole } from '@acc/types';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { NotificationAudienceService } from '../notifications/notification-audience.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { MediaUrlResolver } from '../storage/media-url.resolver';
import { BroadcastService } from './broadcast.service';

const admin: AuthUser = {
  id: 'admin-1',
  firstName: 'Admin',
  lastName: 'User',
  mobileNumber: '+15555550001',
  email: 'admin@acc.local',
  centerId: 'center-A',
  jerseyNumber: 1,
  profilePhotoUrl: null,
  role: UserRole.Admin,
  isActive: true,
  teamLeadAssignments: [],
};

describe('BroadcastService', () => {
  let service: BroadcastService;
  let prisma: {
    broadcast: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      updateMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let mediaUrls: { resolveReadUrl: jest.Mock };
  let audit: { record: jest.Mock };
  let notifications: { sendToAudience: jest.Mock };
  let notificationAudience: { resolveAllActiveUsers: jest.Mock };

  beforeEach(() => {
    prisma = {
      broadcast: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)),
    };
    mediaUrls = {
      resolveReadUrl: jest.fn(async (value: string | null) => value),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    notifications = { sendToAudience: jest.fn().mockResolvedValue(undefined) };
    notificationAudience = {
      resolveAllActiveUsers: jest.fn().mockResolvedValue(['u1', 'u2']),
    };

    service = new BroadcastService(
      prisma as unknown as PrismaService,
      mediaUrls as unknown as MediaUrlResolver,
      audit as unknown as AuditService,
      notifications as unknown as NotificationsService,
      notificationAudience as unknown as NotificationAudienceService,
    );
  });

  it('returns null when no active broadcast exists', async () => {
    prisma.broadcast.findFirst.mockResolvedValue(null);
    await expect(service.getActiveBroadcast()).resolves.toBeNull();
  });

  it('rejects post when neither text nor image is provided', async () => {
    await expect(service.createBroadcast(admin, '  ', undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.createBroadcast(admin, '  ', undefined)).rejects.toMatchObject({
      response: { message: BROADCAST_VALIDATION_MESSAGES.contentRequired },
    });
  });

  it('creates a text-only broadcast and supersedes prior actives', async () => {
    const postedAt = new Date('2026-06-08T12:00:00.000Z');
    const expiresAt = new Date('2026-06-09T12:00:00.000Z');
    prisma.broadcast.create.mockResolvedValue({
      id: 'bc-1',
      imageUrl: null,
      text: 'Hello everyone',
      postedBy: admin.id,
      postedAt,
      expiresAt,
    });

    const result = await service.createBroadcast(admin, 'Hello everyone', undefined);

    expect(prisma.broadcast.updateMany).toHaveBeenCalled();
    expect(result.text).toBe('Hello everyone');
    expect(result.imageUrl).toBeNull();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'BROADCAST_POSTED' }),
    );
  });

  it('notifies all active users when a broadcast is published', async () => {
    prisma.broadcast.create.mockResolvedValue({
      id: 'bc-9',
      imageUrl: null,
      text: 'Season starts Monday',
      postedBy: admin.id,
      postedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    await service.createBroadcast(admin, 'Season starts Monday', undefined);

    expect(notificationAudience.resolveAllActiveUsers).toHaveBeenCalled();
    expect(notifications.sendToAudience).toHaveBeenCalledWith(
      ['u1', 'u2'],
      expect.objectContaining({
        triggerKey: 'BROADCAST_POSTED',
        dedupeKey: 'BROADCAST_POSTED:bc-9',
        body: 'Season starts Monday',
        data: { broadcastId: 'bc-9', screen: 'dashboard' },
      }),
    );
  });

  it('does not fail the publish when notification dispatch throws', async () => {
    prisma.broadcast.create.mockResolvedValue({
      id: 'bc-err',
      imageUrl: null,
      text: 'Hi',
      postedBy: admin.id,
      postedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });
    notifications.sendToAudience.mockRejectedValue(new Error('fcm down'));

    await expect(service.createBroadcast(admin, 'Hi', undefined)).resolves.toMatchObject({
      id: 'bc-err',
    });
  });

  it('removes the active broadcast', async () => {
    prisma.broadcast.findFirst.mockResolvedValue({
      id: 'bc-1',
      imageUrl: null,
      text: 'Hello',
      postedBy: admin.id,
      postedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    await service.removeActiveBroadcast(admin);

    expect(prisma.broadcast.update).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'BROADCAST_REMOVED' }),
    );
  });

  it('throws when removing with no active broadcast', async () => {
    prisma.broadcast.findFirst.mockResolvedValue(null);
    await expect(service.removeActiveBroadcast(admin)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists broadcast history newest first with active/expired status', async () => {
    const now = new Date('2026-06-17T20:00:00.000Z');
    jest.useFakeTimers().setSystemTime(now);
    prisma.broadcast.findMany.mockResolvedValue([
      {
        id: 'bc-new',
        imageUrl: null,
        text: 'Latest',
        postedBy: admin.id,
        postedAt: new Date('2026-06-17T12:00:00.000Z'),
        expiresAt: new Date('2026-06-18T12:00:00.000Z'),
        removedAt: null,
        poster: { firstName: 'Admin', lastName: 'User' },
      },
      {
        id: 'bc-old',
        imageUrl: 'broadcasts/x.jpg',
        text: 'Old',
        postedBy: admin.id,
        postedAt: new Date('2026-06-01T12:00:00.000Z'),
        expiresAt: new Date('2026-06-02T12:00:00.000Z'),
        removedAt: new Date('2026-06-10T12:00:00.000Z'),
        poster: { firstName: 'Admin', lastName: 'User' },
      },
    ]);

    const rows = await service.listBroadcastHistory();
    expect(rows).toHaveLength(2);
    expect(rows[0]?.id).toBe('bc-new');
    expect(rows[0]?.status).toBe('ACTIVE');
    expect(rows[1]?.status).toBe('EXPIRED');
    jest.useRealTimers();
  });
});
