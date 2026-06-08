import 'reflect-metadata';

import {
  type AuthUser,
  Permission,
  REGISTRATION_DECLINED_MESSAGE,
  RegistrationStatus,
  UserRole,
} from '@acc/types';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { AuditService } from '../audit/audit.service';
import { NotificationsService, NotificationTrigger } from '../notifications/notifications.service';
import { PermissionService } from '../authz/permission.service';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitRegistrationDto } from './dto/submit-registration.dto';
import { RegistrationsService } from './registrations.service';

function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'reg-1',
    tournamentId: 'tour-1',
    userId: 'player-1',
    centerId: 'center-A',
    status: RegistrationStatus.InWaitlist,
    battingStyle: null,
    battingRating: null,
    bowlingStyle: null,
    bowlingRating: null,
    fieldingRating: null,
    fieldingPosition: null,
    isAvailable: null,
    availabilityNote: null,
    customFields: null,
    reviewedByUserId: null,
    reviewedAt: null,
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
    user: {
      firstName: 'Arjun',
      lastName: 'Mehta',
      mobileNumber: '+15555551234',
      profilePhotoUrl: null,
    },
    center: { name: 'Surat Center' },
    ...overrides,
  };
}

const admin: AuthUser = {
  id: 'admin-1',
  firstName: 'Platform',
  lastName: 'Admin',
  mobileNumber: '+15555550001',
  email: 'admin@acc.local',
  centerId: 'center-A',
  jerseyNumber: 0,
  profilePhotoUrl: null,
  role: UserRole.Admin,
  isActive: true,
};

const sevak: AuthUser = { ...admin, id: 'sevak-1', role: UserRole.Player };

describe('RegistrationsService', () => {
  let service: RegistrationsService;
  let prisma: {
    tournament: { findUnique: jest.Mock };
    user: { findUnique: jest.Mock };
    registration: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      upsert: jest.Mock;
      update: jest.Mock;
    };
    registrationFieldDefinition: {
      findMany: jest.Mock;
      deleteMany: jest.Mock;
      createMany: jest.Mock;
    };
    customFormRequest: { create: jest.Mock; findMany: jest.Mock };
    roleAssignment: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let permissions: { check: jest.Mock };
  let notifications: { notify: jest.Mock };
  let audit: { record: jest.Mock };

  beforeEach(() => {
    prisma = {
      tournament: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'tour-1', state: 'REGISTRATION_OPEN', type: 'APL' }),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'player-1', centerId: 'center-A' }) },
      registration: {
        findUnique: jest.fn().mockResolvedValue(row()),
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue(row()),
        update: jest.fn().mockResolvedValue(row()),
      },
      registrationFieldDefinition: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      customFormRequest: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      roleAssignment: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    permissions = { check: jest.fn().mockResolvedValue(false) };
    notifications = { notify: jest.fn().mockResolvedValue(undefined) };
    audit = { record: jest.fn().mockResolvedValue(undefined) };

    service = new RegistrationsService(
      prisma as unknown as PrismaService,
      permissions as unknown as PermissionService,
      notifications as unknown as NotificationsService,
      audit as unknown as AuditService,
    );
  });

  describe('submission lifecycle (§7.3)', () => {
    it('rejects submission when registration is not open', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-1',
        state: 'REGISTRATION_CLOSED',
        type: 'APL',
      });
      await expect(service.submit(sevak, 'tour-1', {})).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates a registration In Waitlist on submit', async () => {
      await service.submit(sevak, 'tour-1', { fieldingPosition: 'Slip' });
      expect(prisma.registration.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tournamentId_userId: { tournamentId: 'tour-1', userId: 'sevak-1' } },
        }),
      );
      const args = prisma.registration.upsert.mock.calls[0][0] as {
        create: { status: string };
      };
      expect(args.create.status).toBe(RegistrationStatus.InWaitlist);
    });

    it('confirms and notifies the player on approve', async () => {
      prisma.registration.findUnique.mockResolvedValue({
        id: 'reg-1',
        status: 'IN_WAITLIST',
        userId: 'player-1',
        tournamentId: 'tour-1',
      });
      prisma.registration.update.mockResolvedValue(row({ status: RegistrationStatus.Confirmed }));

      const result = await service.approve(admin, 'reg-1');

      expect(result.status).toBe(RegistrationStatus.Confirmed);
      expect(notifications.notify).toHaveBeenCalledWith(
        NotificationTrigger.RegistrationConfirmed,
        expect.objectContaining({ recipientUserIds: ['player-1'] }),
      );
    });

    it('declines and notifies the player; the spec decline text is exported', async () => {
      prisma.registration.findUnique.mockResolvedValue({
        id: 'reg-1',
        status: 'IN_WAITLIST',
        userId: 'player-1',
        tournamentId: 'tour-1',
      });
      prisma.registration.update.mockResolvedValue(row({ status: RegistrationStatus.Declined }));

      const result = await service.decline(admin, 'reg-1');

      expect(result.status).toBe(RegistrationStatus.Declined);
      expect(notifications.notify).toHaveBeenCalledWith(
        NotificationTrigger.RegistrationDeclined,
        expect.objectContaining({ recipientUserIds: ['player-1'] }),
      );
      expect(REGISTRATION_DECLINED_MESSAGE).toBe('Declined. Contact Center Sevak');
    });
  });

  describe('visibility rules (§7.4)', () => {
    it('Admin sees every Center (no Center filter applied)', async () => {
      await service.list(admin, 'tour-1', {});
      const where = prisma.registration.findMany.mock.calls[0][0].where as Record<string, unknown>;
      expect(where).not.toHaveProperty('centerId');
    });

    it('a Center Sevak is restricted to their own Center', async () => {
      prisma.roleAssignment.findMany.mockResolvedValue([{ centerId: 'center-A' }]);
      await service.list(sevak, 'tour-1', {});
      const where = prisma.registration.findMany.mock.calls[0][0].where as {
        centerId: { in: string[] };
      };
      expect(where.centerId).toEqual({ in: ['center-A'] });
    });

    it('a Center Sevak gets an empty list when filtering to another Center', async () => {
      prisma.roleAssignment.findMany.mockResolvedValue([{ centerId: 'center-A' }]);
      const result = await service.list(sevak, 'tour-1', { centerId: 'center-B' });
      expect(result).toEqual([]);
      expect(prisma.registration.findMany).not.toHaveBeenCalled();
    });

    it('forbids a player with no Center/all-Center grant from listing', async () => {
      prisma.roleAssignment.findMany.mockResolvedValue([]);
      await expect(service.list(sevak, 'tour-1', {})).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('a Club Manager with the APL all-Centers grant sees every Center', async () => {
      permissions.check.mockResolvedValue(true);
      const cm: AuthUser = { ...sevak, id: 'cm-1', role: UserRole.ClubManager };
      await service.list(cm, 'tour-1', {});
      expect(permissions.check).toHaveBeenCalledWith(
        Permission.VIEW_REGISTRATIONS_ALL_CENTERS,
        cm,
        { tournamentId: 'tour-1' },
      );
      const where = prisma.registration.findMany.mock.calls[0][0].where as Record<string, unknown>;
      expect(where).not.toHaveProperty('centerId');
    });
  });

  describe('late registration (§7.6)', () => {
    it('is blocked unless the tournament is Registration Closed', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-1',
        state: 'REGISTRATION_OPEN',
        type: 'APL',
      });
      await expect(
        service.lateRegister(admin, 'tour-1', { userId: 'player-1' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('checks REGISTER_LATE_PLAYER with the target player Center', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-1',
        state: 'REGISTRATION_CLOSED',
        type: 'APL',
      });
      prisma.user.findUnique.mockResolvedValue({ id: 'player-1', centerId: 'center-A' });
      permissions.check.mockResolvedValue(true);

      await service.lateRegister(admin, 'tour-1', { userId: 'player-1' });

      expect(permissions.check).toHaveBeenCalledWith(Permission.REGISTER_LATE_PLAYER, admin, {
        tournamentId: 'tour-1',
        targetCenterId: 'center-A',
        targetUserId: 'player-1',
      });
      expect(prisma.registration.upsert).toHaveBeenCalled();
    });

    it('forbids late registration when the permission check fails', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-1',
        state: 'REGISTRATION_CLOSED',
        type: 'APL',
      });
      permissions.check.mockResolvedValue(false);
      await expect(
        service.lateRegister(sevak, 'tour-1', { userId: 'player-1' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('availability summary (§7.5)', () => {
    it('aggregates confirmed players by availability', async () => {
      prisma.registration.findMany.mockResolvedValue([
        { isAvailable: true },
        { isAvailable: true },
        { isAvailable: false },
        { isAvailable: null },
      ]);
      const summary = await service.availabilitySummary('tour-1');
      expect(summary).toEqual({ available: 2, unavailable: 1, pending: 1, total: 4 });
    });
  });

  describe('custom forms (§7.2)', () => {
    it('replaces the field definitions on build', async () => {
      await service.buildCustomForm('tour-1', {
        fields: [{ key: 'tshirt', label: 'T-Shirt Size', fieldType: 'SELECT', options: ['S', 'M'] }],
      });
      expect(prisma.registrationFieldDefinition.deleteMany).toHaveBeenCalledWith({
        where: { tournamentId: 'tour-1' },
      });
      expect(prisma.registrationFieldDefinition.createMany).toHaveBeenCalled();
    });

    it('rejects duplicate field keys', async () => {
      await expect(
        service.buildCustomForm('tour-1', {
          fields: [
            { key: 'dup', label: 'A', fieldType: 'TEXT' },
            { key: 'dup', label: 'B', fieldType: 'TEXT' },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('blocks submission missing a required custom field', async () => {
      prisma.registrationFieldDefinition.findMany.mockResolvedValue([
        { key: 'jersey', label: 'Jersey Name' },
      ]);
      await expect(service.submit(sevak, 'tour-1', { customFields: {} })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});

describe('SubmitRegistrationDto', () => {
  it('rejects a rating outside 0–5', () => {
    const dto = plainToInstance(SubmitRegistrationDto, { battingRating: 9 });
    const errors = validateSync(dto);
    expect(errors.some((e) => e.property === 'battingRating')).toBe(true);
  });

  it('accepts an empty submission', () => {
    const dto = plainToInstance(SubmitRegistrationDto, {});
    expect(validateSync(dto)).toHaveLength(0);
  });
});
