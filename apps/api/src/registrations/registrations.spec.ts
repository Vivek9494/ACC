import 'reflect-metadata';

import {
  type AuthUser,
  Permission,
  REGISTRATION_DECLINED_MESSAGE,
  RegistrationStatus,
  RegistrationVerificationPhase,
  RegistrationPlayerType,
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
import { LeatherTournamentVisibilityService } from '../tournaments/leather-tournament-visibility.service';

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

const centerSevak: AuthUser = {
  ...admin,
  id: 'sevak-1',
  role: UserRole.CenterSevak,
  centerSevakCenterIds: ['center-A'],
};

const captain: AuthUser = {
  ...admin,
  id: 'captain-1',
  role: UserRole.Player,
  teamLeadAssignments: [
    { role: UserRole.Captain, tournamentId: 'tour-1', teamId: 'team-1' },
  ],
};

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
      count: jest.Mock;
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
    roleAssignment: { findMany: jest.Mock; findFirst: jest.Mock };
    tournamentCenter: { findMany: jest.Mock; findFirst: jest.Mock };
    teamRegistrationFavourite: {
      findMany: jest.Mock;
      upsert: jest.Mock;
      deleteMany: jest.Mock;
    };
    playerSkillVideo: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let permissions: { check: jest.Mock };
  let notifications: { notify: jest.Mock; sendToAudience: jest.Mock };
  let audit: { record: jest.Mock };

  beforeEach(() => {
    prisma = {
      tournament: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tour-1',
          name: 'APL 2026',
          state: 'REGISTRATION_OPEN',
          type: 'APL',
          ballType: 'TENNIS',
          timezone: 'America/Toronto',
          isDeleted: false,
          videoRequired: false,
          videoUploadEndDate: null,
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
        count: jest.fn().mockResolvedValue(0),
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
      roleAssignment: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      tournamentCenter: {
        findMany: jest.fn().mockResolvedValue([{ centerId: 'center-A' }]),
        findFirst: jest.fn().mockResolvedValue({ centerId: 'center-A' }),
      },
      teamRegistrationFavourite: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      playerSkillVideo: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    permissions = { check: jest.fn().mockResolvedValue(false) };
    notifications = { notify: jest.fn().mockResolvedValue(undefined), sendToAudience: jest.fn().mockResolvedValue({ sent: true }) };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    const leatherVisibility = {
      assertCanRegisterForLeather: jest.fn().mockResolvedValue(undefined),
      listLateRegisterCandidates: jest.fn().mockResolvedValue([]),
    };
    const mediaUrls = {
      resolveReadUrl: jest.fn(async (value: string | null) => value),
      resolveReadUrls: jest.fn(async (values: (string | null)[]) => values),
      resolveField: jest.fn(async <T extends Record<string, unknown>, K extends keyof T>(row: T, _field: K) => row),
      resolveFields: jest.fn(async <T extends Record<string, unknown>, K extends keyof T>(rows: T[], _field: K) => rows),
      resolveProfilePhoto: jest.fn(async <T extends { profilePhotoUrl: string | null }>(row: T) => row),
      resolveProfilePhotoUrls: jest.fn(async <T extends { profilePhotoUrl: string | null }>(rows: T[]) => rows),
    };

    service = new RegistrationsService(
      prisma as unknown as PrismaService,
      permissions as unknown as PermissionService,
      notifications as unknown as NotificationsService,
      audit as unknown as AuditService,
      leatherVisibility as unknown as LeatherTournamentVisibilityService,
      mediaUrls as unknown as import('../storage/media-url.resolver').MediaUrlResolver,
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

    it('creates a registration In Waitlist on submit for tennis', async () => {
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

    it('creates a confirmed registration on submit for leather ACC', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-acc',
        state: 'REGISTRATION_OPEN',
        type: 'ACC',
        ballType: 'LEATHER',
        isDeleted: false,
        ...openRegistrationWindow,
      });
      prisma.registration.upsert.mockResolvedValue(
        row({ tournamentId: 'tour-acc', status: RegistrationStatus.Confirmed }),
      );

      const result = await service.submit(sevak, 'tour-acc', {
        ...submitPayload,
        playerType: RegistrationPlayerType.FullTime,
      });

      const args = prisma.registration.upsert.mock.calls[0][0] as {
        create: { status: string };
      };
      expect(args.create.status).toBe(RegistrationStatus.Confirmed);
      expect(result.status).toBe(RegistrationStatus.Confirmed);
      expect(notifications.sendToAudience).toHaveBeenCalledWith(
        ['sevak-1'],
        expect.objectContaining({
          triggerKey: NotificationTrigger.RegistrationConfirmed,
        }),
      );
    });

    it('allows Center Sevak to self-register during an open window', async () => {
      await service.submit(centerSevak, 'tour-1', submitPayload);
      expect(prisma.registration.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tournamentId_userId: { tournamentId: 'tour-1', userId: 'sevak-1' } },
        }),
      );
    });

    it('notifies the registrant of the video upload deadline when required', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-1',
        name: 'APL 2026',
        state: 'REGISTRATION_OPEN',
        type: 'APL',
        ballType: 'TENNIS',
        timezone: 'America/Toronto',
        isDeleted: false,
        videoRequired: true,
        videoUploadEndDate: new Date('2026-08-15T23:59:59.000Z'),
        ...openRegistrationWindow,
      });

      await service.submit(sevak, 'tour-1', submitPayload);

      expect(notifications.sendToAudience).toHaveBeenCalledWith(
        ['sevak-1'],
        expect.objectContaining({
          triggerKey: NotificationTrigger.VideoUploadDeadline,
          dedupeKey: `${NotificationTrigger.VideoUploadDeadline}:tour-1:sevak-1`,
          data: { tournamentId: 'tour-1', screen: 'tournament' },
        }),
      );
    });

    it('allows Club Manager to self-register during an open window', async () => {
      const clubManager: AuthUser = { ...admin, id: 'cm-1', role: UserRole.ClubManager };
      await service.submit(clubManager, 'tour-1', submitPayload);
      expect(prisma.registration.upsert).toHaveBeenCalled();
    });

    it('allows Vice Captain to self-register during an open window', async () => {
      const viceCaptain: AuthUser = { ...admin, id: 'vc-1', role: UserRole.ViceCaptain };
      await service.submit(viceCaptain, 'tour-1', submitPayload);
      expect(prisma.registration.upsert).toHaveBeenCalled();
    });

    it('allows Manager to self-register during an open window', async () => {
      const manager: AuthUser = { ...admin, id: 'mgr-1', role: UserRole.Manager };
      await service.submit(manager, 'tour-1', submitPayload);
      expect(prisma.registration.upsert).toHaveBeenCalled();
    });

    it('rejects Admin self-registration', async () => {
      await expect(service.submit(admin, 'tour-1', submitPayload)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('confirms and notifies the player on approve', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-1',
        name: 'APL 2026',
        state: 'REGISTRATION_OPEN',
        type: 'APL',
        ballType: 'TENNIS',
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
      expect(notifications.sendToAudience).toHaveBeenCalledWith(
        ['player-1'],
        expect.objectContaining({
          triggerKey: NotificationTrigger.RegistrationConfirmed,
        }),
      );
    });

    it('blocks approve while the registration window is still open', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-1',
        state: 'REGISTRATION_OPEN',
        type: 'APL',
        ballType: 'TENNIS',
        isDeleted: false,
        ...openRegistrationWindow,
      });
      prisma.registration.findUnique.mockResolvedValue({
        id: 'reg-1',
        status: 'IN_WAITLIST',
        userId: 'player-1',
        tournamentId: 'tour-1',
      });
      await expect(service.approve(admin, 'reg-1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects approve/decline on leather ACC', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-acc',
        state: 'REGISTRATION_OPEN',
        type: 'ACC',
        ballType: 'LEATHER',
        isDeleted: false,
        ...closedRegistrationWindow,
      });
      prisma.registration.findUnique.mockResolvedValue({
        id: 'reg-1',
        status: 'CONFIRMED',
        userId: 'player-1',
        tournamentId: 'tour-acc',
      });
      await expect(service.approve(admin, 'reg-1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('declines and notifies the player; the spec decline text is exported', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-1',
        name: 'APL 2026',
        state: 'REGISTRATION_OPEN',
        type: 'APL',
        ballType: 'TENNIS',
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
      expect(notifications.sendToAudience).toHaveBeenCalledWith(
        ['player-1'],
        expect.objectContaining({
          triggerKey: NotificationTrigger.RegistrationDeclined,
          body: REGISTRATION_DECLINED_MESSAGE,
        }),
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
      permissions.check.mockResolvedValue(true);
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
      expect(result.canLateRegister).toBe(true);
    });

    it('returns pending count after the registration window closes', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-1',
        state: 'REGISTRATION_OPEN',
        type: 'APL',
        ballType: 'TENNIS',
        isDeleted: false,
        ...closedRegistrationWindow,
      });
      permissions.check.mockImplementation(async (permission: Permission) =>
        permission === Permission.VIEW_REGISTRATIONS_OWN_CENTER,
      );
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
        ballType: 'TENNIS',
        isDeleted: false,
        ...closedRegistrationWindow,
      });
      permissions.check.mockImplementation(async (permission: Permission) =>
        permission === Permission.VIEW_REGISTRATIONS_OWN_CENTER,
      );
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

    it('allows late registration when permission is granted (any window state)', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-1',
        state: 'REGISTRATION_OPEN',
        type: 'APL',
        ballType: 'TENNIS',
        isDeleted: false,
        ...openRegistrationWindow,
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

    it('allows late registration when the window is closed and permission granted', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-1',
        state: 'REGISTRATION_OPEN',
        type: 'APL',
        ballType: 'TENNIS',
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
        ballType: 'TENNIS',
        isDeleted: false,
        ...closedRegistrationWindow,
      });
      prisma.roleAssignment.findMany.mockResolvedValue([{ centerId: 'center-A' }]);
      prisma.registration.findMany.mockResolvedValue([
        row({ status: RegistrationStatus.InWaitlist }),
        row({ id: 'reg-late', status: RegistrationStatus.Confirmed, userId: 'player-2' }),
      ]);
      prisma.user.findMany.mockResolvedValue([]);
      permissions.check.mockImplementation(async (permission: Permission) =>
        permission === Permission.VIEW_REGISTRATIONS_OWN_CENTER,
      );

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

    it('forbids Center Sevak on a leather ACC tournament', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-acc',
        state: 'REGISTRATION_OPEN',
        type: 'ACC',
        ballType: 'LEATHER',
        isDeleted: false,
        ...closedRegistrationWindow,
      });
      prisma.roleAssignment.findMany.mockResolvedValue([{ centerId: 'center-A' }]);
      await expect(service.getVerificationQueue(sevak, 'tour-acc')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('forbids verification queue on leather for any role', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-acc',
        state: 'REGISTRATION_OPEN',
        type: 'ACC',
        ballType: 'LEATHER',
        isDeleted: false,
        ...closedRegistrationWindow,
      });
      await expect(service.getVerificationQueue(admin, 'tour-acc')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('verified registered players (team leads)', () => {
    beforeEach(() => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-1',
        state: 'REGISTRATION_CLOSED',
        type: 'APL',
        ballType: 'TENNIS',
        isDeleted: false,
        ...closedRegistrationWindow,
      });
      prisma.registration.count.mockResolvedValue(0);
      prisma.registration.findMany.mockResolvedValue([
        row({ status: RegistrationStatus.Confirmed }),
      ]);
      permissions.check.mockResolvedValue(true);
      prisma.roleAssignment.findFirst.mockResolvedValue({ teamId: 'team-1' });
    });

    it('returns confirmed registrants for a captain after verification', async () => {
      const captainWithoutJwtAssignments: AuthUser = {
        ...captain,
        teamLeadAssignments: [],
      };

      const result = await service.listVerifiedRegisteredPlayers(
        captainWithoutJwtAssignments,
        'tour-1',
        {},
      );

      expect(result.players).toHaveLength(1);
      expect(result.canFavourite).toBe(true);
      expect(result.favouriteTeamId).toBe('team-1');
      expect(result.canLateRegister).toBe(true);
      expect(result.players[0]?.isFavourited).toBe(false);
      expect(result.players[0]?.hasSkillVideo).toBe(false);
      expect(result.players[0]?.skillVideoId).toBeNull();
      expect(permissions.check).toHaveBeenCalledWith(
        Permission.VIEW_VERIFIED_REGISTERED_PLAYERS,
        captainWithoutJwtAssignments,
        { tournamentId: 'tour-1' },
      );
    });

    it('includes hasSkillVideo when a player uploaded a ready skill video', async () => {
      prisma.playerSkillVideo.findMany.mockResolvedValue([
        { id: 'vid-1', userId: 'player-1' },
      ]);

      const result = await service.listVerifiedRegisteredPlayers(captain, 'tour-1', {});

      expect(result.players[0]?.hasSkillVideo).toBe(true);
      expect(result.players[0]?.skillVideoId).toBe('vid-1');
    });

    it('favourites a verified registrant for the captain team', async () => {
      prisma.registration.findUnique.mockResolvedValue(
        row({ status: RegistrationStatus.Confirmed }),
      );

      const result = await service.setRegistrationFavourite(
        captain,
        'tour-1',
        'player-1',
        true,
      );

      expect(result).toEqual({ userId: 'player-1', isFavourited: true });
      expect(prisma.teamRegistrationFavourite.upsert).toHaveBeenCalled();
    });

    it('rejects favouriting from a Club Manager without team leadership', async () => {
      const clubManager: AuthUser = {
        ...captain,
        id: 'cm-1',
        role: UserRole.ClubManager,
        teamLeadAssignments: [],
      };
      permissions.check.mockResolvedValue(true);
      prisma.roleAssignment.findFirst.mockResolvedValue(null);

      await expect(
        service.setRegistrationFavourite(clubManager, 'tour-1', 'player-1', true),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows a Club Manager who is also Captain to favourite for their team', async () => {
      const clubManagerCaptain: AuthUser = {
        ...captain,
        id: 'cm-cap-1',
        role: UserRole.ClubManager,
        teamLeadAssignments: [
          { role: UserRole.Captain, tournamentId: 'tour-1', teamId: 'team-1' },
        ],
      };
      permissions.check.mockResolvedValue(true);
      prisma.registration.findUnique.mockResolvedValue(
        row({ status: RegistrationStatus.Confirmed }),
      );

      const result = await service.setRegistrationFavourite(
        clubManagerCaptain,
        'tour-1',
        'player-1',
        true,
      );

      expect(result.isFavourited).toBe(true);
      expect(prisma.teamRegistrationFavourite.upsert).toHaveBeenCalled();
    });

    it('favourites a verified registrant for the manager team', async () => {
      const manager: AuthUser = {
        ...captain,
        id: 'manager-1',
        role: UserRole.Player,
        teamLeadAssignments: [
          { role: UserRole.Manager, tournamentId: 'tour-1', teamId: 'team-1' },
        ],
      };
      prisma.registration.findUnique.mockResolvedValue(
        row({ status: RegistrationStatus.Confirmed }),
      );

      const result = await service.setRegistrationFavourite(
        manager,
        'tour-1',
        'player-1',
        true,
      );

      expect(result).toEqual({ userId: 'player-1', isFavourited: true });
      expect(prisma.teamRegistrationFavourite.upsert).toHaveBeenCalled();
    });

    it('rejects when verification is still pending', async () => {
      prisma.registration.count.mockResolvedValue(2);

      await expect(
        service.listVerifiedRegisteredPlayers(captain, 'tour-1', {}),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('leather registered players (Admin / Club Manager)', () => {
    const clubManager: AuthUser = {
      ...admin,
      id: 'cm-1',
      role: UserRole.ClubManager,
    };

    beforeEach(() => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-acc',
        state: 'REGISTRATION_OPEN',
        type: 'ACC',
        ballType: 'LEATHER',
        isDeleted: false,
        ...openRegistrationWindow,
      });
      prisma.registration.findMany.mockResolvedValue([
        row({ status: RegistrationStatus.Confirmed, playerType: RegistrationPlayerType.FullTime }),
      ]);
      prisma.registration.count.mockResolvedValue(1);
      permissions.check.mockResolvedValue(true);
    });

    it('returns confirmed leather registrants for a Club Manager', async () => {
      const result = await service.listLeatherRegisteredPlayers(clubManager, 'tour-acc', {});

      expect(result.players).toHaveLength(1);
      expect(result.totalCount).toBe(1);
      expect(result.canLateRegister).toBe(true);
      expect(permissions.check).toHaveBeenCalledWith(
        Permission.VIEW_LEATHER_REGISTERED_PLAYERS,
        clubManager,
        { tournamentId: 'tour-acc' },
      );
    });

    it('rejects leather list on tennis tournaments', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-1',
        state: 'REGISTRATION_OPEN',
        type: 'APL',
        ballType: 'TENNIS',
        isDeleted: false,
        ...openRegistrationWindow,
      });

      await expect(
        service.listLeatherRegisteredPlayers(clubManager, 'tour-1', {}),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects before registration opens', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-acc',
        state: 'NEW',
        type: 'ACC',
        ballType: 'LEATHER',
        isDeleted: false,
        registrationOpenAt: new Date('2099-01-01T00:00:00.000Z'),
        registrationCloseAt: new Date('2099-12-31T23:59:59.000Z'),
      });

      await expect(
        service.listLeatherRegisteredPlayers(clubManager, 'tour-acc', {}),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects a regular player', async () => {
      permissions.check.mockResolvedValue(false);

      await expect(
        service.listLeatherRegisteredPlayers(captain, 'tour-acc', {}),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('favourite players list (team shared)', () => {
    beforeEach(() => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-1',
        state: 'REGISTRATION_CLOSED',
        type: 'APL',
        ballType: 'TENNIS',
        isDeleted: false,
        ...closedRegistrationWindow,
      });
      prisma.registration.count.mockResolvedValue(0);
      permissions.check.mockResolvedValue(true);
      prisma.roleAssignment.findFirst.mockResolvedValue({ teamId: 'team-1' });
    });

    it('returns the team shared favourites for a captain', async () => {
      prisma.teamRegistrationFavourite.findMany.mockResolvedValue([{ userId: 'player-1' }]);
      prisma.registration.findMany.mockResolvedValue([
        row({ status: RegistrationStatus.Confirmed, userId: 'player-1' }),
      ]);

      const result = await service.listFavouritePlayers(captain, 'tour-1');

      expect(result.favourites).toHaveLength(1);
      expect(result.canFavourite).toBe(true);
      expect(result.favouriteTeamId).toBe('team-1');
      expect(result.favourites[0]?.hasSkillVideo).toBe(false);
      expect(result.favourites[0]?.skillVideoId).toBeNull();
    });

    it('includes hasSkillVideo on favourite players with a ready skill video', async () => {
      prisma.teamRegistrationFavourite.findMany.mockResolvedValue([{ userId: 'player-1' }]);
      prisma.registration.findMany.mockResolvedValue([
        row({ status: RegistrationStatus.Confirmed, userId: 'player-1' }),
      ]);
      prisma.playerSkillVideo.findMany.mockResolvedValue([
        { id: 'vid-1', userId: 'player-1' },
      ]);

      const result = await service.listFavouritePlayers(captain, 'tour-1');

      expect(result.favourites[0]?.hasSkillVideo).toBe(true);
      expect(result.favourites[0]?.skillVideoId).toBe('vid-1');
    });

    it('returns the team shared favourites for a manager', async () => {
      const manager: AuthUser = {
        ...captain,
        id: 'manager-1',
        role: UserRole.Player,
        teamLeadAssignments: [
          { role: UserRole.Manager, tournamentId: 'tour-1', teamId: 'team-1' },
        ],
      };
      prisma.teamRegistrationFavourite.findMany.mockResolvedValue([{ userId: 'player-1' }]);
      prisma.registration.findMany.mockResolvedValue([
        row({ status: RegistrationStatus.Confirmed, userId: 'player-1' }),
      ]);

      const result = await service.listFavouritePlayers(manager, 'tour-1');

      expect(result.favourites).toHaveLength(1);
      expect(result.canFavourite).toBe(true);
      expect(result.favouriteTeamId).toBe('team-1');
    });

    it('returns empty favourites for a Club Manager without team leadership', async () => {
      const clubManager: AuthUser = {
        ...captain,
        id: 'cm-1',
        role: UserRole.ClubManager,
        teamLeadAssignments: [],
      };
      prisma.roleAssignment.findFirst.mockResolvedValue(null);

      const result = await service.listFavouritePlayers(clubManager, 'tour-1');

      expect(result.favourites).toHaveLength(0);
      expect(result.canFavourite).toBe(false);
      expect(result.favouriteTeamId).toBeNull();
    });
  });

  describe('late registration (§7.6)', () => {
    it('allows late registration while the registration window is still open', async () => {
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
        }),
      );

      const result = await service.lateRegister(admin, 'tour-1', {
        ...submitPayload,
        userId: 'player-1',
      });

      expect(result.status).toBe(RegistrationStatus.Confirmed);
    });

    it('creates a confirmed registration after the window closes', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-1',
        name: 'APL 2026',
        state: 'REGISTRATION_OPEN',
        type: 'APL',
        ballType: 'TENNIS',
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
            source: 'LATE_REGISTER',
          }),
        }),
      );
      expect(notifications.sendToAudience).toHaveBeenCalledWith(
        ['player-1'],
        expect.objectContaining({
          triggerKey: NotificationTrigger.RegistrationConfirmed,
        }),
      );
    });

    it('rejects late registration when the player center is not in the tournament', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-1',
        state: 'REGISTRATION_OPEN',
        type: 'CENTER',
        ballType: 'TENNIS',
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
      prisma.tournamentCenter.findFirst.mockResolvedValue(null);

      await expect(
        service.lateRegister(admin, 'tour-1', { ...submitPayload, userId: 'player-1' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('blocks Center Sevak late registration on leather ACC', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-acc',
        state: 'REGISTRATION_OPEN',
        type: 'ACC',
        ballType: 'LEATHER',
        isDeleted: false,
        ...closedRegistrationWindow,
      });
      await expect(
        service.lateRegister(centerSevak, 'tour-acc', { ...submitPayload, userId: 'player-1' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
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
        ballType: 'TENNIS',
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
  it('rejects a rating outside 0–10', () => {
    const dto = plainToInstance(SubmitRegistrationDto, { battingRating: 11 });
    const errors = validateSync(dto);
    expect(errors.some((e) => e.property === 'battingRating')).toBe(true);
  });

  it('accepts a rating within 0–10', () => {
    const dto = plainToInstance(SubmitRegistrationDto, { ...submitPayload, battingRating: 9 });
    const errors = validateSync(dto);
    expect(errors.some((e) => e.property === 'battingRating')).toBe(false);
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
  it('rejects a batting rating outside 0–10', () => {
    const dto = plainToInstance(UpdateRatingsDto, { battingRating: 11 });
    const errors = validateSync(dto);
    expect(errors.some((e) => e.property === 'battingRating')).toBe(true);
  });

  it('rejects a non-integer batting rating', () => {
    const dto = plainToInstance(UpdateRatingsDto, { battingRating: 4.5 });
    const errors = validateSync(dto);
    expect(errors.some((e) => e.property === 'battingRating')).toBe(true);
  });

  it('accepts registration-scale ratings', () => {
    const dto = plainToInstance(UpdateRatingsDto, {
      battingRating: 8,
      bowlingRating: 6,
      fieldingRating: 10,
    });
    expect(validateSync(dto)).toHaveLength(0);
  });
});
