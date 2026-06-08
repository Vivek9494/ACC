import 'reflect-metadata';

import { type AuthUser, Permission, TournamentState, UserRole } from '@acc/types';
import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { PermissionService } from '../authz/permission.service';
import { TournamentTypeResolverService } from '../authz/tournament-type-resolver.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { TournamentsService } from './tournaments.service';

interface TxMock {
  tournament: { create: jest.Mock };
  center: { findMany: jest.Mock };
  tournamentCenter: { createMany: jest.Mock };
  team: { findMany: jest.Mock; create: jest.Mock };
  roleAssignment: { findMany: jest.Mock; createMany: jest.Mock };
}

function detailRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'tid',
    name: 'ACC 2026',
    year: 2026,
    type: 'ACC',
    state: 'NEW',
    ballType: 'LEATHER',
    posterUrl: null,
    startAt: new Date('2026-05-01T00:00:00.000Z'),
    endAt: new Date('2026-09-30T00:00:00.000Z'),
    oversPerInnings: 25,
    maxOversPerBowler: 5,
    location: null,
    format: 'LEAGUE_SINGLE_ROUND_ROBIN',
    impactPlayerEnabled: false,
    videoRequired: false,
    videoUploadEndDate: null,
    youtubeUrl: null,
    registrationOpenAt: null,
    registrationCloseAt: null,
    teams: [],
    _count: { teams: 0 },
    ...overrides,
  };
}

const actor: AuthUser = {
  id: 'cm-1',
  firstName: 'Club',
  lastName: 'Manager',
  mobileNumber: '+15555550002',
  email: 'cm@acc.local',
  centerId: 'center-A',
  jerseyNumber: 0,
  profilePhotoUrl: null,
  role: UserRole.ClubManager,
  isActive: true,
};

describe('TournamentsService', () => {
  let service: TournamentsService;
  let prisma: {
    $transaction: jest.Mock;
    tournament: { findUnique: jest.Mock; findFirst: jest.Mock; update: jest.Mock; delete: jest.Mock };
    roleAssignment: { findFirst: jest.Mock; count: jest.Mock };
    registration: { findMany: jest.Mock };
    province: { findUnique: jest.Mock };
    center: { findMany: jest.Mock };
  };
  let permissions: { check: jest.Mock };
  let notifications: { notify: jest.Mock };
  let tx: TxMock;

  beforeEach(async () => {
    tx = {
      tournament: { create: jest.fn().mockResolvedValue({ id: 'tid' }) },
      center: { findMany: jest.fn().mockResolvedValue([]) },
      tournamentCenter: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
      team: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }: { data: { name: string } }) =>
          Promise.resolve({ id: `new-${data.name}`, name: data.name }),
        ),
      },
      roleAssignment: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    prisma = {
      $transaction: jest.fn((cb: (t: TxMock) => unknown) => cb(tx)),
      tournament: {
        findUnique: jest.fn().mockResolvedValue(detailRow()),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
      roleAssignment: { findFirst: jest.fn().mockResolvedValue(null), count: jest.fn() },
      registration: { findMany: jest.fn().mockResolvedValue([]) },
      province: {
        findUnique: jest.fn().mockResolvedValue({ id: 'prov-1', isActive: true }),
      },
      center: {
        findMany: jest.fn().mockResolvedValue([{ id: 'center-A' }, { id: 'center-B' }]),
      },
    };
    permissions = { check: jest.fn().mockResolvedValue(true) };
    notifications = { notify: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TournamentsService,
        TournamentTypeResolverService,
        { provide: PrismaService, useValue: prisma },
        { provide: PermissionService, useValue: permissions },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = moduleRef.get(TournamentsService);
  });

  const baseDto = (overrides: Partial<CreateTournamentDto> = {}): CreateTournamentDto =>
    ({
      name: 'ACC 2026',
      year: 2026,
      oversPerInnings: 25,
      maxOversPerBowler: 5,
      startAt: '2026-05-01T00:00:00.000Z',
      endAt: '2026-09-30T00:00:00.000Z',
      ballType: 'LEATHER',
      citySelection: 'SINGLE',
      format: 'LEAGUE_SINGLE_ROUND_ROBIN',
      impactPlayerEnabled: false,
      videoRequired: false,
      ...overrides,
    }) as CreateTournamentDto;

  describe('type resolution drives the create permission (§1.1)', () => {
    it('resolves a Leather tournament to ACC and checks CREATE_ACC_TOURNAMENT', async () => {
      await service.create(actor, baseDto({ ballType: 'LEATHER' }));
      expect(permissions.check).toHaveBeenCalledWith(
        Permission.CREATE_ACC_TOURNAMENT,
        actor,
        {},
      );
    });

    it('resolves Tennis + Club Manager + ALL cities to APL and checks CREATE_APL_TOURNAMENT', async () => {
      await service.create(
        actor,
        baseDto({ ballType: 'TENNIS', citySelection: 'ALL', provinceId: 'prov-1' }),
      );
      expect(permissions.check).toHaveBeenCalledWith(
        Permission.CREATE_APL_TOURNAMENT,
        actor,
        {},
      );
    });
  });

  describe('clone-from-past copies team names only (§6.2)', () => {
    it('creates new teams with the source names and never copies players', async () => {
      tx.team.findMany.mockResolvedValue([
        { id: 'old-1', name: 'Titans XI' },
        { id: 'old-2', name: 'Lions CC' },
      ]);

      await service.create(
        actor,
        baseDto({ cloneFromTournamentId: 'past-1', copyRoleAssignments: false }),
      );

      expect(tx.team.create).toHaveBeenCalledTimes(2);
      expect(tx.team.create).toHaveBeenCalledWith({
        data: { tournamentId: 'tid', name: 'Titans XI' },
      });
      expect(tx.team.create).toHaveBeenCalledWith({
        data: { tournamentId: 'tid', name: 'Lions CC' },
      });
      // Role assignments only copied when explicitly requested.
      expect(tx.roleAssignment.createMany).not.toHaveBeenCalled();
      // The service has no team-membership write path — players are never cloned.
      expect(tx).not.toHaveProperty('teamMembership');
    });

    it('copies captain/VC/manager assignments when requested', async () => {
      tx.team.findMany.mockResolvedValue([{ id: 'old-1', name: 'Titans XI' }]);
      tx.roleAssignment.findMany.mockResolvedValue([
        { userId: 'u1', role: UserRole.Captain },
      ]);

      await service.create(
        actor,
        baseDto({ cloneFromTournamentId: 'past-1', copyRoleAssignments: true }),
      );

      expect(tx.roleAssignment.createMany).toHaveBeenCalledWith({
        data: [
          { userId: 'u1', role: UserRole.Captain, tournamentId: 'tid', teamId: 'new-Titans XI' },
        ],
        skipDuplicates: true,
      });
    });
  });

  describe('state transitions are guarded by the §5.1 graph', () => {
    it('rejects an illegal transition (NEW → TEAMS_FINALIZED)', async () => {
      prisma.tournament.findUnique.mockResolvedValueOnce(detailRow({ state: 'NEW' }));
      await expect(
        service.transition('tid', TournamentState.TeamsFinalized),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.tournament.update).not.toHaveBeenCalled();
    });

    it('allows a legal transition (NEW → REGISTRATION_OPEN)', async () => {
      prisma.tournament.findUnique.mockResolvedValueOnce(detailRow({ state: 'NEW' }));
      await service.transition('tid', TournamentState.RegistrationOpen);
      expect(prisma.tournament.update).toHaveBeenCalledWith({
        where: { id: 'tid' },
        data: { state: TournamentState.RegistrationOpen },
      });
    });
  });

  describe('mid-tournament edit notifies registrants when registration is open (§6.4)', () => {
    it('notifies registrants for an open tournament', async () => {
      prisma.tournament.findUnique.mockResolvedValueOnce(detailRow({ state: 'REGISTRATION_OPEN' }));
      prisma.registration.findMany.mockResolvedValue([{ userId: 'p1' }, { userId: 'p2' }]);

      await service.update('tid', { location: 'New Ground' });

      expect(notifications.notify).toHaveBeenCalledWith(
        'TOURNAMENT_EDITED_MID_REGISTRATION',
        expect.objectContaining({ recipientUserIds: ['p1', 'p2'] }),
      );
    });

    it('does not notify when the tournament is not in registration', async () => {
      prisma.tournament.findUnique.mockResolvedValueOnce(detailRow({ state: 'LIVE' }));
      await service.update('tid', { location: 'New Ground' });
      expect(notifications.notify).not.toHaveBeenCalled();
    });
  });
});

describe('CreateTournamentDto', () => {
  it('rejects a Powerplay Overs input (removed per §6.1)', () => {
    const dto = plainToInstance(CreateTournamentDto, {
      name: 'X',
      year: 2026,
      oversPerInnings: 25,
      maxOversPerBowler: 5,
      startAt: '2026-05-01T00:00:00.000Z',
      endAt: '2026-09-30T00:00:00.000Z',
      ballType: 'LEATHER',
      citySelection: 'SINGLE',
      format: 'LEAGUE_SINGLE_ROUND_ROBIN',
      impactPlayerEnabled: false,
      videoRequired: false,
      powerplayOvers: 5,
    });
    const errors = validateSync(dto);
    const powerplayError = errors.find((e) => e.property === 'powerplayOvers');
    expect(powerplayError).toBeDefined();
  });

  it('accepts a valid payload without powerplay', () => {
    const dto = plainToInstance(CreateTournamentDto, {
      name: 'X',
      year: 2026,
      oversPerInnings: 25,
      maxOversPerBowler: 5,
      startAt: '2026-05-01T00:00:00.000Z',
      endAt: '2026-09-30T00:00:00.000Z',
      ballType: 'LEATHER',
      citySelection: 'SINGLE',
      format: 'LEAGUE_SINGLE_ROUND_ROBIN',
      impactPlayerEnabled: false,
      videoRequired: false,
    });
    expect(validateSync(dto)).toHaveLength(0);
  });
});
