import 'reflect-metadata';

import {
  type AuthUser,
  Permission,
  UserRole,
} from '@acc/types';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { ExecutionContext } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PermissionGuard } from '../authz/permission.guard';
import { PermissionService } from '../authz/permission.service';
import { PrismaService } from '../prisma/prisma.service';
import { CentersService } from './centers.service';
import { ProvincesService } from './provinces.service';

const admin: AuthUser = {
  id: 'admin-1',
  firstName: 'Platform',
  lastName: 'Admin',
  mobileNumber: '+15555550001',
  email: 'admin@acc.local',
  centerId: 'center-1',
  jerseyNumber: 0,
  profilePhotoUrl: null,
  role: UserRole.Admin,
  isActive: true,
};

const clubManager: AuthUser = {
  ...admin,
  id: 'cm-1',
  role: UserRole.ClubManager,
};

function prismaKnownError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('constraint', {
    code,
    clientVersion: 'test',
  });
}

describe('ProvincesService', () => {
  let service: ProvincesService;
  let prisma: {
    province: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      province: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [ProvincesService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(ProvincesService);
  });

  it('blocks delete when province still has centers', async () => {
    prisma.province.findUnique.mockResolvedValue({
      id: 'prov-1',
      name: 'Ontario',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      _count: { centers: 3 },
    });

    await expect(service.remove('prov-1')).rejects.toMatchObject({
      response: expect.objectContaining({
        error: 'PROVINCE_HAS_CENTERS',
        references: { centers: 3 },
      }),
    });
    expect(prisma.province.delete).not.toHaveBeenCalled();
  });
});

describe('CentersService', () => {
  let service: CentersService;
  let prisma: {
    center: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    province: { findUnique: jest.Mock };
    user: { count: jest.Mock };
    registration: { count: jest.Mock };
    tournamentCenter: { count: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      center: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      province: { findUnique: jest.fn().mockResolvedValue({ id: 'prov-1' }) },
      user: { count: jest.fn() },
      registration: { count: jest.fn() },
      tournamentCenter: { count: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [CentersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(CentersService);
  });

  it('blocks delete when center is referenced by users, registrations, or tournaments', async () => {
    prisma.center.findUnique.mockResolvedValue({ id: 'c-1', name: 'Brampton' });
    prisma.user.count.mockResolvedValue(2);
    prisma.registration.count.mockResolvedValue(1);
    prisma.tournamentCenter.count.mockResolvedValue(1);

    await expect(service.remove('c-1')).rejects.toMatchObject({
      response: expect.objectContaining({
        error: 'CENTER_IN_USE',
        references: { users: 2, registrations: 1, tournaments: 1 },
      }),
    });
    expect(prisma.center.delete).not.toHaveBeenCalled();
  });

  it('rejects duplicate center name within the same province', async () => {
    prisma.center.create.mockRejectedValue(prismaKnownError('P2002'));

    await expect(
      service.create({ name: 'Brampton', provinceId: 'prov-1' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws when updating a missing center', async () => {
    prisma.center.findUnique.mockResolvedValue(null);
    await expect(service.update('missing', { name: 'X' })).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('Province/Center mutation RBAC', () => {
  let permissions: { check: jest.Mock };

  beforeEach(() => {
    permissions = { check: jest.fn() };
  });

  it('allows Admin to manage provinces', async () => {
    permissions.check.mockResolvedValue(true);
    const reflector = new Reflector();
    const guarded = new PermissionGuard(reflector, permissions as unknown as PermissionService);
    const request = { user: admin };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(Permission.MANAGE_PROVINCES);

    await expect(guarded.canActivate(context)).resolves.toBe(true);
  });

  it('returns 403 for non-Admin on every province/center mutation', async () => {
    permissions.check.mockResolvedValue(false);
    const reflector = new Reflector();
    const guarded = new PermissionGuard(reflector, permissions as unknown as PermissionService);
    const request = { user: clubManager };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    for (const permission of [Permission.MANAGE_PROVINCES, Permission.MANAGE_CENTERS]) {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(permission);
      await expect(guarded.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
    }
  });
});
