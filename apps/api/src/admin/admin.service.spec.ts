import 'reflect-metadata';

import { BadRequestException, NotFoundException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { DashboardFeaturedMatchesService } from '../matches/dashboard-featured-matches.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdminService } from './admin.service';

describe('AdminService user management', () => {
  let prisma: {
    user: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    center: {
      findUnique: jest.Mock;
    };
    roleAssignment: {
      deleteMany: jest.Mock;
      create: jest.Mock;
    };
  };
  let audit: { record: jest.Mock };
  let playerStats: { buildCareerStats: jest.Mock };
  let redis: { del: jest.Mock };
  let service: AdminService;

  const actor = { id: 'admin-1', role: 'ADMIN' } as never;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      center: {
        findUnique: jest.fn(),
      },
      roleAssignment: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({ id: 'ra-1' }),
      },
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    playerStats = {
      buildCareerStats: jest.fn().mockResolvedValue({
        career: { matches: 0, runs: 0, wickets: 0, stumpings: 0 },
        byYear: [],
        byTournament: [],
      }),
    };
    redis = { del: jest.fn().mockResolvedValue(undefined) };
    const mediaUrls = {
      resolveReadUrl: jest.fn(async (value: string | null) => value),
      resolveProfilePhoto: jest.fn(async <T extends { profilePhotoUrl: string | null }>(row: T) => row),
      resolveProfilePhotoUrls: jest.fn(async <T extends { profilePhotoUrl: string | null }>(rows: T[]) => rows),
    };
    const dashboardFeaturedMatches = {
      loadTodayMatches: jest.fn().mockResolvedValue([]),
    };
    service = new AdminService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
      playerStats as never,
      redis as never,
      mediaUrls as never,
      dashboardFeaturedMatches as unknown as DashboardFeaturedMatchesService,
    );
  });

  it('deactivates a user, bumps tokenVersion, and audits', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-2',
      isActive: true,
      deletedAt: null,
    });
    prisma.user.update.mockResolvedValue({ id: 'user-2', isActive: false });

    const result = await service.setUserStatus(actor, 'user-2', false);

    expect(result).toEqual({ id: 'user-2', isActive: false });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-2' },
      data: { isActive: false, tokenVersion: { increment: 1 } },
      select: { id: true, isActive: true },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'USER_STATUS_CHANGED',
        actorUserId: 'admin-1',
        targetUserId: 'user-2',
        before: { isActive: true },
        after: { isActive: false },
      }),
    );
  });

  it('reactivates without bumping tokenVersion', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-2',
      isActive: false,
      deletedAt: null,
    });
    prisma.user.update.mockResolvedValue({ id: 'user-2', isActive: true });

    await service.setUserStatus(actor, 'user-2', true);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-2' },
      data: { isActive: true },
      select: { id: true, isActive: true },
    });
  });

  it('rejects self status change', async () => {
    await expect(service.setUserStatus(actor, 'admin-1', false)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('soft-deletes a user and audits', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-2',
      deletedAt: null,
      isActive: true,
    });
    prisma.user.update.mockResolvedValue({ id: 'user-2' });

    await service.softDeleteUser(actor, 'user-2');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-2' },
      data: {
        deletedAt: expect.any(Date),
        isActive: false,
        tokenVersion: { increment: 1 },
      },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'USER_SOFT_DELETED',
        actorUserId: 'admin-1',
        targetUserId: 'user-2',
      }),
    );
  });

  it('rejects soft-delete when user is already deleted', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-2',
      deletedAt: new Date(),
      isActive: false,
    });

    await expect(service.softDeleteUser(actor, 'user-2')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('creates a user with a temporary password and audits', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.center.findUnique.mockResolvedValue({
      id: 'center-1',
      isActive: true,
      provinceId: 'province-1',
    });
    prisma.user.create.mockResolvedValue({
      id: 'user-new',
      firstName: 'Ambrish',
      lastName: 'Patel',
    });

    const getUserSpy = jest.spyOn(service, 'getUser').mockResolvedValue({
      id: 'user-new',
    } as never);

    const result = await service.createUser(actor, {
      firstName: 'Ambrish',
      lastName: 'Patel',
      mobileNumber: '+14165551234',
      platformRole: 'PLAYER',
      provinceId: 'province-1',
      centerId: 'center-1',
      email: 'ambrish@example.com',
    } as never);

    expect(result.temporaryPassword).toEqual(expect.any(String));
    expect(result.expiresAt).toEqual(expect.any(String));
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          firstName: 'Ambrish',
          lastName: 'Patel',
          centerId: 'center-1',
          mustChangePassword: true,
          role: 'PLAYER',
        }),
      }),
    );
    expect(prisma.roleAssignment.deleteMany).toHaveBeenCalled();
    expect(prisma.roleAssignment.create).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'USER_CREATED',
        actorUserId: 'admin-1',
        targetUserId: 'user-new',
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'USER_TEMP_PASSWORD_GENERATED',
        actorUserId: 'admin-1',
        targetUserId: 'user-new',
        details: expect.objectContaining({ issuedOnCreate: true }),
      }),
    );

    getUserSpy.mockRestore();
  });

  it('creates a Center Sevak RoleAssignment when creating a Sevak user', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.center.findUnique.mockResolvedValue({
      id: 'center-1',
      isActive: true,
      provinceId: 'province-1',
    });
    prisma.user.create.mockResolvedValue({
      id: 'sevak-new',
      firstName: 'Nikhil',
      lastName: 'Sevak',
    });

    const getUserSpy = jest.spyOn(service, 'getUser').mockResolvedValue({
      id: 'sevak-new',
    } as never);

    await service.createUser(actor, {
      firstName: 'Nikhil',
      lastName: 'Sevak',
      mobileNumber: '+14165559999',
      platformRole: 'CENTER_SEVAK',
      provinceId: 'province-1',
      centerId: 'center-1',
      email: 'nikhil@example.com',
    } as never);

    expect(prisma.roleAssignment.create).toHaveBeenCalledWith({
      data: {
        userId: 'sevak-new',
        role: 'CENTER_SEVAK',
        centerId: 'center-1',
      },
    });

    getUserSpy.mockRestore();
  });
});
