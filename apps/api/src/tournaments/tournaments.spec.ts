import 'reflect-metadata';

import { type AuthUser, Permission, TournamentState, UserRole } from '@acc/types';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { PermissionService } from '../authz/permission.service';
import { TournamentTypeResolverService } from '../authz/tournament-type-resolver.service';
import { MediaUrlResolver } from '../storage/media-url.resolver';
import { S3StorageService } from '../storage/s3-storage.service';
import { NotificationAudienceService } from '../notifications/notification-audience.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { LeatherTournamentVisibilityService } from './leather-tournament-visibility.service';
import { TournamentsService } from './tournaments.service';
import { TournamentScorersService } from './tournament-scorers.service';
import { KnockoutBracketService } from '../knockout-bracket/knockout-bracket.service';
import { PlayerSkillVideosService } from '../player-videos/player-skill-videos.service';

interface TxMock {
  tournament: { create: jest.Mock; update: jest.Mock };
  tournamentDate: { createMany: jest.Mock; deleteMany: jest.Mock };
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
    startAt: new Date('2027-05-01T00:00:00.000Z'),
    endAt: new Date('2027-09-30T00:00:00.000Z'),
    oversPerInnings: 25,
    maxOversPerBowler: 5,
    numberOfTeams: 4,
    playersPerTeam: 15,
    substitutesAllowed: 2,
    locationAddress: null,
    provinceId: null,
    format: 'LEAGUE_SINGLE_ROUND_ROBIN',
    impactPlayerEnabled: false,
    videoRequired: false,
    videoUploadStartAt: null,
    videoUploadEndDate: null,
    youtubeUrl: null,
    registrationOpenAt: null,
    registrationCloseAt: null,
    auctionAt: null,
    createdByUserId: 'cm-1',
    isDeleted: false,
    deletedAt: null,
    deletedById: null,
    teams: [],
    groups: [],
    scheduledDates: [
      { date: new Date('2027-06-15T00:00:00.000Z') },
      { date: new Date('2027-09-30T00:00:00.000Z') },
    ],
    _count: { teams: 0, groups: 0 },
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

const sevak: AuthUser = {
  id: 'sevak-1',
  firstName: 'Arjun',
  lastName: 'Sevak',
  mobileNumber: '+15555550005',
  email: 'sevak@acc.local',
  centerId: 'center-A',
  jerseyNumber: 0,
  profilePhotoUrl: null,
  role: UserRole.CenterSevak,
  isActive: true,
};

describe('TournamentsService', () => {
  let service: TournamentsService;
  let prisma: {
    $transaction: jest.Mock;
    tournament: { findUnique: jest.Mock; findFirst: jest.Mock; update: jest.Mock; delete: jest.Mock };
    match: { findMany: jest.Mock };
    roleAssignment: { findFirst: jest.Mock; findMany: jest.Mock; count: jest.Mock };
    tournamentCenter: { findFirst: jest.Mock };
    teamMembership: { findUnique: jest.Mock };
    registration: { findMany: jest.Mock };
    province: { findUnique: jest.Mock };
    center: { findMany: jest.Mock };
  };
  let permissions: { check: jest.Mock };
  let notifications: { notify: jest.Mock; sendToAudience: jest.Mock };
  let storage: { deleteObject: jest.Mock; resolveObjectKey: jest.Mock };
  let mediaUrls: { resolveReadUrl: jest.Mock; resolveReadUrls: jest.Mock };
  let tx: TxMock;

  beforeEach(async () => {
    tx = {
      tournament: {
        create: jest.fn().mockResolvedValue({ id: 'tid' }),
        update: jest.fn().mockResolvedValue({}),
      },
      tournamentDate: {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
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
      roleAssignment: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn(),
      },
      tournamentCenter: { findFirst: jest.fn().mockResolvedValue(null) },
      teamMembership: { findUnique: jest.fn().mockResolvedValue(null) },
      match: { findMany: jest.fn().mockResolvedValue([]) },
      registration: { findMany: jest.fn().mockResolvedValue([]) },
      province: {
        findUnique: jest.fn().mockResolvedValue({ id: 'prov-1', isActive: true }),
      },
      center: {
        findMany: jest.fn().mockResolvedValue([{ id: 'center-A' }, { id: 'center-B' }]),
      },
    };
    permissions = { check: jest.fn().mockResolvedValue(true) };
    notifications = {
      notify: jest.fn().mockResolvedValue(undefined),
      sendToAudience: jest.fn().mockResolvedValue({ sent: true }),
    };
    storage = {
      deleteObject: jest.fn().mockResolvedValue(undefined),
      resolveObjectKey: jest.fn((value: string | null | undefined) => value ?? null),
    };
    mediaUrls = {
      resolveReadUrl: jest.fn(async (value: string | null) => value),
      resolveReadUrls: jest.fn(async (values: (string | null)[]) => values),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TournamentsService,
        TournamentTypeResolverService,
        { provide: PrismaService, useValue: prisma },
        { provide: PermissionService, useValue: permissions },
        { provide: NotificationsService, useValue: notifications },
        {
          provide: NotificationAudienceService,
          useValue: {
            resolveTournamentAudience: jest.fn().mockResolvedValue([]),
            resolveTournamentRegisteredPlayers: jest.fn().mockResolvedValue(['p1', 'p2']),
          },
        },
        { provide: S3StorageService, useValue: storage },
        { provide: MediaUrlResolver, useValue: mediaUrls },
        {
          provide: PlayerSkillVideosService,
          useValue: { viewerUploadFlags: jest.fn().mockResolvedValue({}) },
        },
        {
          provide: LeatherTournamentVisibilityService,
          useValue: {
            getVisibleLeatherTournamentIds: jest.fn().mockResolvedValue([]),
            assertCanViewLeatherTournament: jest.fn().mockResolvedValue(undefined),
            canRegisterForLeatherTournament: jest.fn().mockResolvedValue(false),
          },
        },
        {
          provide: TournamentScorersService,
          useValue: {
            loadParticipatingCenterIds: jest.fn().mockResolvedValue([]),
            buildViewerFlags: jest.fn().mockResolvedValue({
              canManageTournamentScorers: false,
              tournamentScorerCount: 0,
            }),
          },
        },
        {
          provide: KnockoutBracketService,
          useValue: { hasKnockoutBracket: jest.fn().mockResolvedValue(false) },
        },
      ],
    }).compile();

    service = moduleRef.get(TournamentsService);
  });

  const baseDto = (overrides: Partial<CreateTournamentDto> = {}): CreateTournamentDto =>
    ({
      name: 'ACC 2026',
      year: 2026,
      posterUrl: 'https://example.com/poster.jpg',
      maxOversPerBowler: 5,
      numberOfTeams: 4,
      playersPerTeam: 15,
      substitutesAllowed: 2,
      dates: ['2027-06-15', '2027-07-01', '2027-09-30'],
      ballType: 'LEATHER',
      citySelection: 'SINGLE',
      provinceId: 'prov-1',
      format: 'LEAGUE_SINGLE_ROUND_ROBIN',
      impactPlayerEnabled: false,
      videoRequired: false,
      ...overrides,
    }) as CreateTournamentDto;

  const tennisDto = (overrides: Partial<CreateTournamentDto> = {}): CreateTournamentDto =>
    baseDto({
      ballType: 'TENNIS',
      locationAddress: '123 Main St, Toronto, ON',
      latitude: 43.6532,
      longitude: -79.3832,
      ...overrides,
    });

  describe('type resolution drives the create permission', () => {
    it('resolves a Leather tournament to ACC and checks CREATE_ACC_TOURNAMENT', async () => {
      await service.create(actor, baseDto({ ballType: 'LEATHER', citySelection: undefined }));
      expect(permissions.check).toHaveBeenCalledWith(
        Permission.CREATE_ACC_TOURNAMENT,
        actor,
        {},
      );
    });

    it('resolves Tennis + Club Manager + ALL cities to APL and checks CREATE_APL_TOURNAMENT', async () => {
      await service.create(
        actor,
        tennisDto({ citySelection: 'ALL', provinceId: 'prov-1' }),
      );
      expect(permissions.check).toHaveBeenCalledWith(
        Permission.CREATE_APL_TOURNAMENT,
        actor,
        {},
      );
    });

    it('resolves Tennis + Multi-centers to CENTER and checks CREATE_CENTER_TOURNAMENT', async () => {
      tx.center.findMany.mockResolvedValue([{ id: 'center-A' }, { id: 'center-B' }]);
      await service.create(
        actor,
        tennisDto({
          citySelection: 'MULTI',
          provinceId: 'prov-1',
          centerIds: ['center-A'],
        }),
      );
      expect(permissions.check).toHaveBeenCalledWith(
        Permission.CREATE_CENTER_TOURNAMENT,
        actor,
        {},
      );
    });

    it('rejects Center Sevak creating Leather/ACC (CREATE_ACC_TOURNAMENT)', async () => {
      permissions.check.mockResolvedValueOnce(false);
      await expect(
        service.create(sevak, baseDto({ ballType: 'LEATHER' })),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(permissions.check).toHaveBeenCalledWith(
        Permission.CREATE_ACC_TOURNAMENT,
        sevak,
        {},
      );
    });

    it('rejects Multi-centers without selected centers', async () => {
      await expect(
        service.create(
          actor,
          baseDto({
            ballType: 'TENNIS',
            citySelection: 'MULTI',
            provinceId: 'prov-1',
            centerIds: [],
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects create without tournament dates', async () => {
      await expect(
        service.create(actor, baseDto({ dates: [] })),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('stores tournament dates and derives start/end window', async () => {
      await service.create(
        actor,
        baseDto({ dates: ['2027-06-20', '2027-06-15', '2027-07-10'] }),
      );
      expect(tx.tournament.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            startAt: new Date('2027-06-15T00:00:00.000Z'),
            endAt: new Date('2027-07-10T00:00:00.000Z'),
          }),
        }),
      );
      expect(tx.tournamentDate.createMany).toHaveBeenCalledWith({
        data: [
          { tournamentId: 'tid', date: new Date('2027-06-15T00:00:00.000Z') },
          { tournamentId: 'tid', date: new Date('2027-06-20T00:00:00.000Z') },
          { tournamentId: 'tid', date: new Date('2027-07-10T00:00:00.000Z') },
        ],
      });
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
        data: { tournamentId: 'tid', name: 'Titans XI', nameNormalized: 'titans xi' },
      });
      expect(tx.team.create).toHaveBeenCalledWith({
        data: { tournamentId: 'tid', name: 'Lions CC', nameNormalized: 'lions cc' },
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
      const row = detailRow({ state: 'REGISTRATION_OPEN' });
      prisma.tournament.findUnique.mockResolvedValue(row);
      prisma.tournament.findFirst.mockResolvedValue({ id: 'tid', name: 'ACC 2026', isDeleted: false });

      await service.update(actor, 'tid', { locationAddress: 'New Ground' });

      expect(notifications.sendToAudience).toHaveBeenCalledWith(
        ['p1', 'p2'],
        expect.objectContaining({
          triggerKey: 'TOURNAMENT_EDITED_MID_REGISTRATION',
        }),
      );
    });

    it('does not notify when the tournament is not in registration', async () => {
      prisma.tournament.findUnique.mockResolvedValue(detailRow({ state: 'LIVE' }));
      await service.update(actor, 'tid', { locationAddress: 'New Ground' });
      expect(notifications.sendToAudience).not.toHaveBeenCalled();
      expect(notifications.notify).not.toHaveBeenCalled();
    });
  });

  describe('numberOfTeams on edit', () => {
    it('allows setting numberOfTeams to the active team count (soft-deleted teams excluded)', async () => {
      prisma.tournament.findUnique.mockResolvedValue(
        detailRow({ numberOfTeams: 28, _count: { teams: 8, groups: 0 } }),
      );

      await service.update(actor, 'tid', { numberOfTeams: 8 });

      expect(tx.tournament.update).toHaveBeenCalled();
    });

    it('rejects numberOfTeams below the active team count', async () => {
      prisma.tournament.findUnique.mockResolvedValue(
        detailRow({ numberOfTeams: 28, _count: { teams: 8, groups: 0 } }),
      );

      await expect(service.update(actor, 'tid', { numberOfTeams: 7 })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(tx.tournament.update).not.toHaveBeenCalled();
    });
  });

  describe('Center Sevak tournament ownership (§7.4)', () => {
    it('allows a Center Sevak to update a tournament they created', async () => {
      prisma.tournament.findUnique.mockResolvedValue(
        detailRow({ createdByUserId: 'sevak-1' }),
      );

      await service.update(sevak, 'tid', { locationAddress: 'New Ground' });

      expect(tx.tournament.update).toHaveBeenCalled();
    });

    it('allows a Center Sevak to update a tournament linked to their center', async () => {
      prisma.tournament.findUnique.mockResolvedValue(
        detailRow({ createdByUserId: 'cm-1' }),
      );
      prisma.roleAssignment.findMany.mockResolvedValueOnce([{ centerId: 'center-A' }]);
      prisma.tournamentCenter.findFirst.mockResolvedValueOnce({ centerId: 'center-A' });

      await service.update(sevak, 'tid', { locationAddress: 'New Ground' });

      expect(tx.tournament.update).toHaveBeenCalled();
    });

    it('denies a Center Sevak updating a tournament from another center they did not create', async () => {
      prisma.tournament.findUnique.mockResolvedValueOnce(
        detailRow({ createdByUserId: 'cm-1' }),
      );
      prisma.roleAssignment.findMany.mockResolvedValueOnce([{ centerId: 'center-A' }]);
      prisma.tournamentCenter.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.update(sevak, 'tid', { locationAddress: 'New Ground' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.tournament.update).not.toHaveBeenCalled();
    });

    it('allows a Center Sevak to delete their own tournament', async () => {
      prisma.tournament.findUnique.mockResolvedValueOnce(
        detailRow({ createdByUserId: 'sevak-1', state: 'NEW' }),
      );

      await service.remove(sevak, 'tid');

      expect(prisma.tournament.update).toHaveBeenCalledWith({
        where: { id: 'tid' },
        data: expect.objectContaining({
          isDeleted: true,
          deletedAt: expect.any(Date),
          deletedById: 'sevak-1',
        }),
      });
    });

    it('denies a Center Sevak deleting a tournament from another center they did not create', async () => {
      prisma.tournament.findUnique.mockResolvedValueOnce(
        detailRow({ createdByUserId: 'cm-1', state: 'NEW' }),
      );
      prisma.roleAssignment.findMany.mockResolvedValueOnce([{ centerId: 'center-A' }]);
      prisma.tournamentCenter.findFirst.mockResolvedValueOnce(null);

      await expect(service.remove(sevak, 'tid')).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.tournament.update).not.toHaveBeenCalled();
    });
  });
});

describe('CreateTournamentDto', () => {
  it('rejects a Powerplay Overs input (removed per §6.1)', () => {
    const dto = plainToInstance(CreateTournamentDto, {
      name: 'X',
      year: 2026,
      posterUrl: 'https://example.com/poster.jpg',
      maxOversPerBowler: 5,
      numberOfTeams: 4,
      playersPerTeam: 15,
      substitutesAllowed: 2,
      dates: ['2026-06-15', '2026-09-30'],
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

  it('rejects overs per innings on tournament create (set at match setup)', () => {
    const dto = plainToInstance(CreateTournamentDto, {
      name: 'X',
      year: 2026,
      posterUrl: 'https://example.com/poster.jpg',
      maxOversPerBowler: 5,
      numberOfTeams: 4,
      playersPerTeam: 15,
      substitutesAllowed: 2,
      dates: ['2026-06-15', '2026-09-30'],
      ballType: 'LEATHER',
      provinceId: 'prov-1',
      format: 'LEAGUE_SINGLE_ROUND_ROBIN',
      impactPlayerEnabled: false,
      videoRequired: false,
      oversPerInnings: 25,
    });
    const errors = validateSync(dto);
    expect(errors.some((e) => e.property === 'oversPerInnings')).toBe(true);
  });

  it('rejects numberOfTeams above 30', () => {
    const dto = plainToInstance(CreateTournamentDto, {
      name: 'X',
      year: 2026,
      posterUrl: 'https://example.com/poster.jpg',
      maxOversPerBowler: 5,
      numberOfTeams: 31,
      playersPerTeam: 15,
      substitutesAllowed: 2,
      dates: ['2026-06-15', '2026-09-30'],
      ballType: 'LEATHER',
      provinceId: 'prov-1',
      format: 'LEAGUE_SINGLE_ROUND_ROBIN',
      impactPlayerEnabled: false,
      videoRequired: false,
    });
    const errors = validateSync(dto);
    expect(errors.some((e) => e.property === 'numberOfTeams')).toBe(true);
  });

  it('accepts a valid leather payload without tournament scope', () => {
    const dto = plainToInstance(CreateTournamentDto, {
      name: 'X',
      year: 2026,
      posterUrl: 'https://example.com/poster.jpg',
      maxOversPerBowler: 5,
      numberOfTeams: 4,
      playersPerTeam: 15,
      substitutesAllowed: 2,
      dates: ['2026-06-15', '2026-09-30'],
      ballType: 'LEATHER',
      provinceId: 'prov-1',
      format: 'LEAGUE_SINGLE_ROUND_ROBIN',
      impactPlayerEnabled: false,
      videoRequired: false,
    });
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('accepts a valid tennis payload with scope', () => {
    const dto = plainToInstance(CreateTournamentDto, {
      name: 'X',
      year: 2026,
      posterUrl: 'https://example.com/poster.jpg',
      maxOversPerBowler: 5,
      numberOfTeams: 4,
      playersPerTeam: 15,
      substitutesAllowed: 2,
      dates: ['2026-06-15', '2026-09-30'],
      ballType: 'TENNIS',
      citySelection: 'ALL',
      provinceId: 'prov-1',
      format: 'LEAGUE_SINGLE_ROUND_ROBIN',
      impactPlayerEnabled: false,
      videoRequired: false,
    });
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('requires at least one tournament date', () => {
    const dto = plainToInstance(CreateTournamentDto, {
      name: 'X',
      year: 2026,
      posterUrl: 'https://example.com/poster.jpg',
      maxOversPerBowler: 5,
      numberOfTeams: 4,
      playersPerTeam: 15,
      substitutesAllowed: 2,
      dates: [],
      ballType: 'LEATHER',
      format: 'LEAGUE_SINGLE_ROUND_ROBIN',
      impactPlayerEnabled: false,
      videoRequired: false,
    });
    const errors = validateSync(dto);
    expect(errors.some((e) => e.property === 'dates')).toBe(true);
  });

  it('requires centers for Multi-centers tennis payload', () => {
    const dto = plainToInstance(CreateTournamentDto, {
      name: 'X',
      year: 2026,
      posterUrl: 'https://example.com/poster.jpg',
      maxOversPerBowler: 4,
      numberOfTeams: 8,
      playersPerTeam: 15,
      substitutesAllowed: 2,
      dates: ['2026-06-15', '2026-09-30'],
      ballType: 'TENNIS',
      citySelection: 'MULTI',
      provinceId: 'prov-1',
      format: 'LEAGUE_SINGLE_ROUND_ROBIN',
      impactPlayerEnabled: false,
      videoRequired: false,
    });
    const errors = validateSync(dto);
    expect(errors.some((e) => e.property === 'centerIds')).toBe(true);
  });
});
