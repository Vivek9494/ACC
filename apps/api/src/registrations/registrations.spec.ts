import 'reflect-metadata';

import {
  type AuthUser,
  Permission,
  REGISTRATION_DECLINED_MESSAGE,
  RegistrationStatus,
  RegistrationVerificationPhase,
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
import { UpdateRatingsDto } from './dto/update-ratings.dto';
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
    battingPosition: null,
    playerRole: null,
    bowlingStyle: null,
    bowlingType: null,
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

const openRegistrationWindow = {
  registrationOpenAt: new Date('2026-01-01T00:00:00.000Z'),
  registrationCloseAt: new Date('2026-12-31T23:59:59.000Z'),
};

const closedRegistrationWindow = {
  registrationOpenAt: new Date('2020-01-01T00:00:00.000Z'),
  registrationCloseAt: new Date('2020-01-02T00:00:00.000Z'),
};

const testCenterId = '11111111-1111-4111-8111-111111111111';

const submitPayload = {
  firstName: 'Arjun',
  lastName: 'Mehta',
  centerId: testCenterId,
  fieldingPosition: 'Slips',
};

describe('RegistrationsService', () => {
  let service: RegistrationsService;
  let prisma: {
    tournament: { findUnique: jest.Mock };
    user: { findUnique: jest.Mock; findMany: jest.Mock; update: jest.Mock };
    center: { findUnique: jest.Mock };
    registration: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      upsert: jest.Mock;
      create: jest.Mock;
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
        findUnique: jest.fn().mockResolvedValue({
          id: 'tour-1',
          state: 'REGISTRATION_OPEN',
          type: 'APL',
          isDeleted: false,
          ...openRegistrationWindow,
        }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'player-1',
          centerId: 'center-A',
          center: { provinceId: 'prov-1' },
        }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
      center: {
        findUnique: jest.fn().mockResolvedValue({ id: testCenterId, provinceId: 'prov-1' }),
      },
      registration: {
        findUnique: jest.fn().mockResolvedValue(row()),
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue(row()),
        create: jest.fn().mockResolvedValue(row()),
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
    it('rejects submission when the registration window is closed', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-1',
        state: 'REGISTRATION_OPEN',
        type: 'APL',
        isDeleted: false,
        registrationOpenAt: new Date('2020-01-01T00:00:00.000Z'),
        registrationCloseAt: new Date('2020-01-02T00:00:00.000Z'),
      });
      await expect(service.submit(sevak, 'tour-1', submitPayload)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('creates a registration In Waitlist on submit', async () => {
      await service.submit(sevak, 'tour-1', submitPayload);
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
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-1',
        state: 'REGISTRATION_OPEN',
        type: 'APL',
        isDeleted: false,
        ...closedRegistrationWindow,
      });
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

    it('blocks approve while the registration window is still open', async () => {
      prisma.registration.findUnique.mockResolvedValue({
        id: 'reg-1',
        status: 'IN_WAITLIST',
        userId: 'player-1',
        tournamentId: 'tour-1',
      });
      await expect(service.approve(admin, 'reg-1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('declines and notifies the player; the spec decline text is exported', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-1',
        state: 'REGISTRATION_OPEN',
        type: 'APL',
        isDeleted: false,
        ...closedRegistrationWindow,
      });
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

  describe('verification queue (§7.3, §7.4)', () => {
    it('returns view-only roster count during the registration window', async () => {
      prisma.roleAssignment.findMany.mockResolvedValue([{ centerId: 'center-A' }]);
      prisma.registration.findMany.mockResolvedValue([
        row({ status: RegistrationStatus.InWaitlist }),
        row({ id: 'reg-2', status: RegistrationStatus.Confirmed }),
      ]);
      prisma.user.findMany.mockResolvedValue([
        {
          id: 'player-2',
          centerId: 'center-A',
          firstName: 'Ravi',
          lastName: 'Patel',
          mobileNumber: '+15555559999',
          profilePhotoUrl: null,
        },
      ]);

      const result = await service.getVerificationQueue(sevak, 'tour-1');

      expect(result.phase).toBe(RegistrationVerificationPhase.ViewOnly);
      expect(result.actionCount).toBe(2);
      expect(result.registered).toHaveLength(2);
      expect(result.registeredCount).toBe(2);
      expect(result.notRegistered).toHaveLength(1);
      expect(result.canManage).toBe(false);
      expect(result.canLateRegister).toBe(false);
    });

    it('returns pending count after the registration window closes', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-1',
        state: 'REGISTRATION_OPEN',
        type: 'APL',
        isDeleted: false,
        ...closedRegistrationWindow,
      });
      permissions.check.mockResolvedValue(false);
      prisma.roleAssignment.findMany.mockResolvedValue([{ centerId: 'center-A' }]);
      prisma.registration.findMany.mockResolvedValue([
        row({ status: RegistrationStatus.InWaitlist }),
        row({ id: 'reg-2', status: RegistrationStatus.Confirmed }),
      ]);
      prisma.user.findMany.mockResolvedValue([]);

      const result = await service.getVerificationQueue(sevak, 'tour-1');

      expect(result.phase).toBe(RegistrationVerificationPhase.Manage);
      expect(result.actionCount).toBe(1);
      expect(result.registeredCount).toBe(2);
      expect(result.canManage).toBe(true);
      expect(result.canLateRegister).toBe(false);
    });

    it('orders pending first, then verified, then declined after the window closes', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-1',
        state: 'REGISTRATION_OPEN',
        type: 'APL',
        isDeleted: false,
        ...closedRegistrationWindow,
      });
      permissions.check.mockResolvedValue(false);
      prisma.roleAssignment.findMany.mockResolvedValue([{ centerId: 'center-A' }]);
      prisma.registration.findMany.mockResolvedValue([
        row({
          id: 'reg-verified',
          status: RegistrationStatus.Confirmed,
          user: {
            firstName: 'Zara',
            lastName: 'Alpha',
            mobileNumber: '+15555550002',
            profilePhotoUrl: null,
          },
        }),
        row({
          id: 'reg-pending',
          status: RegistrationStatus.InWaitlist,
          user: {
            firstName: 'Maya',
            lastName: 'Beta',
            mobileNumber: '+15555550003',
            profilePhotoUrl: null,
          },
        }),
        row({
          id: 'reg-declined',
          status: RegistrationStatus.Declined,
          user: {
            firstName: 'Ann',
            lastName: 'Gamma',
            mobileNumber: '+15555550004',
            profilePhotoUrl: null,
          },
        }),
      ]);
      prisma.user.findMany.mockResolvedValue([]);

      const result = await service.getVerificationQueue(sevak, 'tour-1');

      expect(result.registered.map((entry) => entry.id)).toEqual([
        'reg-pending',
        'reg-verified',
        'reg-declined',
      ]);
    });

    it('allows late registration when the window is closed and permission granted', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-1',
        state: 'REGISTRATION_OPEN',
        type: 'APL',
        isDeleted: false,
        ...closedRegistrationWindow,
      });
      prisma.roleAssignment.findMany.mockResolvedValue([{ centerId: 'center-A' }]);
      prisma.registration.findMany.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([
        {
          id: 'player-2',
          centerId: 'center-A',
          firstName: 'Ravi',
          lastName: 'Patel',
          mobileNumber: '+15555559999',
          profilePhotoUrl: null,
        },
      ]);
      permissions.check.mockResolvedValue(true);

      const result = await service.getVerificationQueue(sevak, 'tour-1');

      expect(result.canLateRegister).toBe(true);
    });

    it('excludes confirmed late registrations from the pending verification count', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-1',
        state: 'REGISTRATION_OPEN',
        type: 'APL',
        isDeleted: false,
        ...closedRegistrationWindow,
      });
      prisma.roleAssignment.findMany.mockResolvedValue([{ centerId: 'center-A' }]);
      prisma.registration.findMany.mockResolvedValue([
        row({ status: RegistrationStatus.InWaitlist }),
        row({ id: 'reg-late', status: RegistrationStatus.Confirmed, userId: 'player-2' }),
      ]);
      prisma.user.findMany.mockResolvedValue([]);
      permissions.check.mockResolvedValue(false);

      const result = await service.getVerificationQueue(sevak, 'tour-1');

      expect(result.registeredCount).toBe(2);
      expect(result.actionCount).toBe(1);
    });

    it('forbids the verification queue for users without Center Sevak assignments', async () => {
      prisma.roleAssignment.findMany.mockResolvedValue([]);
      await expect(service.getVerificationQueue(sevak, 'tour-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('late registration (§7.6)', () => {
    it('is blocked while the registration window is still open', async () => {
      await expect(
        service.lateRegister(admin, 'tour-1', { ...submitPayload, userId: 'player-1' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates a confirmed registration after the window closes', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-1',
        state: 'REGISTRATION_OPEN',
        type: 'APL',
        isDeleted: false,
        ...closedRegistrationWindow,
      });
      prisma.registration.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({
        id: 'player-1',
        centerId: testCenterId,
        center: { provinceId: 'prov-1' },
      });
      permissions.check.mockResolvedValue(true);
      prisma.registration.create = jest.fn().mockResolvedValue(
        row({
          status: RegistrationStatus.Confirmed,
          userId: 'player-1',
          battingRating: 4,
          bowlingRating: 3,
          fieldingRating: 2,
        }),
      );

      const result = await service.lateRegister(admin, 'tour-1', {
        ...submitPayload,
        userId: 'player-1',
        battingRating: 4,
        bowlingRating: 3,
        fieldingRating: 2,
      });

      expect(result.status).toBe(RegistrationStatus.Confirmed);
      expect(prisma.registration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: RegistrationStatus.Confirmed,
            battingRating: 4,
            bowlingRating: 3,
            fieldingRating: 2,
            reviewedByUserId: admin.id,
          }),
        }),
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'REGISTRATION_LATE_CONFIRM',
          actorUserId: admin.id,
          after: expect.objectContaining({
            status: RegistrationStatus.Confirmed,
            battingRating: 4,
            source: 'CENTER_SEVAK_LATE',
          }),
        }),
      );
      expect(notifications.notify).toHaveBeenCalledWith(
        NotificationTrigger.RegistrationConfirmed,
        expect.objectContaining({ recipientUserIds: ['player-1'] }),
      );
    });

    it('rejects late registration when the player is already registered', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-1',
        state: 'REGISTRATION_OPEN',
        type: 'APL',
        isDeleted: false,
        ...closedRegistrationWindow,
      });
      prisma.registration.findUnique.mockResolvedValue({ id: 'reg-1' });
      await expect(
        service.lateRegister(admin, 'tour-1', { ...submitPayload, userId: 'player-1' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('checks REGISTER_LATE_PLAYER with the target player Center', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-1',
        state: 'REGISTRATION_OPEN',
        type: 'APL',
        isDeleted: false,
        ...closedRegistrationWindow,
      });
      prisma.registration.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({
        id: 'player-1',
        centerId: testCenterId,
        center: { provinceId: 'prov-1' },
      });
      permissions.check.mockResolvedValue(true);
      prisma.registration.create = jest.fn().mockResolvedValue(row({ userId: 'player-1' }));

      await service.lateRegister(admin, 'tour-1', { ...submitPayload, userId: 'player-1' });

      expect(permissions.check).toHaveBeenCalledWith(Permission.REGISTER_LATE_PLAYER, admin, {
        tournamentId: 'tour-1',
        targetCenterId: testCenterId,
        targetUserId: 'player-1',
      });
    });

    it('forbids late registration when the permission check fails', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-1',
        state: 'REGISTRATION_OPEN',
        type: 'APL',
        isDeleted: false,
        ...closedRegistrationWindow,
      });
      prisma.registration.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({
        id: 'player-1',
        centerId: 'center-A',
      });
      permissions.check.mockResolvedValue(false);
      await expect(
        service.lateRegister(sevak, 'tour-1', { ...submitPayload, userId: 'player-1' }),
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
      await expect(
        service.submit(sevak, 'tour-1', { ...submitPayload, customFields: {} }),
      ).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('ratings adjustment (§7.5)', () => {
    it('blocks adjusted ratings while the registration window is still open', async () => {
      await expect(
        service.updateRatings(admin, 'tour-1', 'reg-1', {
          battingRating: 4,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects rating updates for a player outside the Sevak center', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-1',
        state: 'REGISTRATION_OPEN',
        type: 'APL',
        isDeleted: false,
        ...closedRegistrationWindow,
      });
      prisma.registration.findUnique.mockResolvedValue({
        id: 'reg-1',
        userId: 'player-1',
        tournamentId: 'tour-1',
        centerId: 'other-center',
        battingRating: 3,
        bowlingRating: 2,
        fieldingRating: 1,
      });
      prisma.roleAssignment.findMany.mockResolvedValue([{ centerId: testCenterId }]);

      const centerSevak: AuthUser = { ...admin, id: 'sevak-1', role: UserRole.CenterSevak };

      await expect(
        service.updateRatings(centerSevak, 'tour-1', 'reg-1', { battingRating: 4 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('stores adjusted ratings after the registration window closes', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-1',
        state: 'REGISTRATION_OPEN',
        type: 'APL',
        isDeleted: false,
        registrationOpenAt: new Date('2020-01-01T00:00:00.000Z'),
        registrationCloseAt: new Date('2020-01-02T00:00:00.000Z'),
      });
      prisma.registration.findUnique.mockResolvedValue({
        id: 'reg-1',
        userId: 'player-1',
        tournamentId: 'tour-1',
        centerId: 'center-A',
        battingRating: 3,
        bowlingRating: 2,
        fieldingRating: 1,
      });
      prisma.registration.update.mockResolvedValue(
        row({
          battingRating: 4,
        }),
      );

      const result = await service.updateRatings(admin, 'tour-1', 'reg-1', {
        battingRating: 4,
      });

      expect(result.battingRating).toBe(4);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'REGISTRATION_RATINGS_ADJUST',
          before: { battingRating: 3, bowlingRating: 2, fieldingRating: 1 },
          after: expect.objectContaining({ battingRating: 4 }),
        }),
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

  it('requires name and center on submission', () => {
    const dto = plainToInstance(SubmitRegistrationDto, {});
    const errors = validateSync(dto);
    expect(errors.some((e) => e.property === 'firstName')).toBe(true);
    expect(errors.some((e) => e.property === 'lastName')).toBe(true);
    expect(errors.some((e) => e.property === 'centerId')).toBe(true);
  });

  it('accepts a minimal valid submission payload', () => {
    const dto = plainToInstance(SubmitRegistrationDto, submitPayload);
    expect(validateSync(dto)).toHaveLength(0);
  });
});

describe('UpdateRatingsDto', () => {
  it('rejects a batting rating not on the registration scale', () => {
    const dto = plainToInstance(UpdateRatingsDto, { battingRating: 1 });
    const errors = validateSync(dto);
    expect(errors.some((e) => e.property === 'battingRating')).toBe(true);
  });

  it('accepts registration-scale ratings', () => {
    const dto = plainToInstance(UpdateRatingsDto, {
      battingRating: 4,
      bowlingRating: 3,
      fieldingRating: 5,
    });
    expect(validateSync(dto)).toHaveLength(0);
  });
});
