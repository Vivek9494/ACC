import 'reflect-metadata';

import {
  type AuthUser,
  BallType,
  Permission,
  TournamentType,
  UserRole,
  canViewTeamRosterMobileNumbers,
  canViewTournamentPlayerProfiles,
} from '@acc/types';
import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';

import { PermissionService } from '../authz/permission.service';
import { PrismaService } from '../prisma/prisma.service';
import { TeamsService } from './teams.service';

describe('canViewTeamRosterMobileNumbers', () => {
  const member: AuthUser = {
    id: 'player-1',
    firstName: 'Pat',
    lastName: 'El',
    mobileNumber: '+15555550099',
    email: 'p@acc.local',
    centerId: 'center-A',
    jerseyNumber: 7,
    profilePhotoUrl: null,
    role: UserRole.Player,
    isActive: true,
    teamLeadAssignments: [],
  };

  it('allows Admin and Club Manager for any team', () => {
    expect(
      canViewTeamRosterMobileNumbers({ ...member, role: UserRole.Admin }, false),
    ).toBe(true);
    expect(
      canViewTeamRosterMobileNumbers({ ...member, role: UserRole.ClubManager }, false),
    ).toBe(true);
  });

  it('allows roster members of the viewed team only', () => {
    expect(canViewTeamRosterMobileNumbers(member, true)).toBe(true);
    expect(canViewTeamRosterMobileNumbers(member, false)).toBe(false);
  });

  it('allows roster managers who are not team members', () => {
    expect(canViewTeamRosterMobileNumbers(member, false, true)).toBe(true);
  });

  it('denies guests', () => {
    expect(canViewTeamRosterMobileNumbers(null, true)).toBe(false);
  });
});

const emptyCareerStats = {
  matches: 0,
  battingInnings: 0,
  runs: 0,
  average: null,
  highestScore: null,
  highestScoreOpponent: null,
  highestScoreContext: null,
  strikeRate: null,
  thirties: 0,
  fifties: 0,
  hundreds: 0,
  notOuts: 0,
  wickets: 0,
  bowlingInnings: 0,
  bowlingAverage: null,
  economy: null,
  bowlingStrikeRate: null,
  bowlingRunsConceded: 0,
  bowlingLegalBalls: 0,
  bestBowling: null,
  bestBowlingWickets: null,
  bestBowlingRunsConceded: null,
  bestBowlingContext: null,
  threeWicketHauls: 0,
  fiveWicketHauls: 0,
  catches: 0,
  droppedCatches: 0,
  stumpings: 0,
  sixes: 0,
  fours: 0,
  careerSpanYears: null,
  strikeRateBarPercent: null,
};

const captain: AuthUser = {
  id: 'captain-1',
  firstName: 'Cap',
  lastName: 'Tain',
  mobileNumber: '+15555550001',
  email: 'cap@acc.local',
  centerId: 'center-A',
  jerseyNumber: 7,
  profilePhotoUrl: null,
  role: UserRole.Player,
  isActive: true,
  teamLeadAssignments: [
    { role: UserRole.Captain, tournamentId: 'tour-1', teamId: 'team-home' },
  ],
};

const viceCaptain: AuthUser = {
  ...captain,
  id: 'vc-1',
  teamLeadAssignments: [
    { role: UserRole.ViceCaptain, tournamentId: 'tour-1', teamId: 'team-home' },
  ],
};

const player: AuthUser = {
  ...captain,
  id: 'player-1',
  teamLeadAssignments: [],
};

const clubManager: AuthUser = {
  ...captain,
  id: 'cm-1',
  role: UserRole.ClubManager,
  teamLeadAssignments: [],
};

describe('TeamsService player profile access', () => {
  let service: TeamsService;
  let prisma: {
    tournament: { findUnique: jest.Mock };
    teamMembership: { findFirst: jest.Mock };
    registration: { findUnique: jest.Mock };
    roleAssignment: { findFirst: jest.Mock; findMany: jest.Mock };
    team: { findFirst: jest.Mock };
  };
  let permissions: { check: jest.Mock };
  let playerStats: { buildCareerStats: jest.Mock };

  beforeEach(() => {
    prisma = {
      tournament: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tour-1',
          isDeleted: false,
          ballType: BallType.Leather,
        }),
      },
      teamMembership: {
        findFirst: jest.fn().mockResolvedValue({
          teamId: 'team-away',
          team: { id: 'team-away', name: 'ACC 6' },
          user: {
            id: 'target-1',
            firstName: 'Ravi',
            lastName: 'Patel',
            profilePhotoUrl: null,
            center: { name: 'Surat Center' },
          },
        }),
      },
      registration: {
        findUnique: jest.fn().mockResolvedValue({
          playerRole: 'ALL_ROUNDER',
          fieldingPosition: null,
          battingRating: 8,
          bowlingRating: 6,
          fieldingRating: 7,
        }),
      },
      roleAssignment: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([{ userId: 'other-captain', role: UserRole.Captain }]),
      },
      team: { findFirst: jest.fn() },
    };
    permissions = {
      check: jest.fn().mockImplementation(async (permission: Permission, actor: AuthUser) => {
        if (permission !== Permission.VIEW_TOURNAMENT_PLAYER_PROFILE) {
          return false;
        }
        return canViewTournamentPlayerProfiles(actor, 'tour-1');
      }),
    };
    playerStats = {
      buildCareerStats: jest.fn().mockResolvedValue({
        career: emptyCareerStats,
        byYear: [],
        byTournament: [],
      }),
    };

    service = new TeamsService(
      prisma as unknown as PrismaService,
      permissions as unknown as PermissionService,
      { deleteObject: jest.fn() } as never,
      {
        resolveReadUrl: jest.fn(async (value: string | null) => value),
        resolveReadUrls: jest.fn(async (values: (string | null)[]) => values),
      } as never,
      { assertCenterSevakTournamentAccess: jest.fn() } as never,
      { assertCanViewCenterLevelTournament: jest.fn().mockResolvedValue(undefined) } as never,
      playerStats as never,
      { record: jest.fn() } as never,
      { sendNotification: jest.fn(), sendToAudience: jest.fn() } as never,
    );
  });

  it('allows a captain to view a player on another team in the same tournament', async () => {
    const profile = await service.getPlayerProfile(captain, 'tour-1', 'target-1');

    expect(profile.firstName).toBe('Ravi');
    expect(profile.teamId).toBe('team-away');
    expect(profile.centerName).toBe('Surat Center');
    expect(profile.ballType).toBe(BallType.Leather);
    expect(profile.playerRoleLabel).toBe('All-rounder');
    expect(profile.battingRating).toBe(8);
    expect(profile.bowlingRating).toBe(6);
    expect(profile.fieldingRating).toBe(7);
    expect(profile.showStumpingsCard).toBe(false);
    expect(profile.career).toEqual(emptyCareerStats);
    expect(playerStats.buildCareerStats).toHaveBeenCalledWith('target-1', BallType.Leather);
  });

  it('allows a vice-captain to view a player on another team in the same tournament', async () => {
    const profile = await service.getPlayerProfile(viceCaptain, 'tour-1', 'target-1');

    expect(profile.firstName).toBe('Ravi');
    expect(profile.teamId).toBe('team-away');
  });

  it('rejects a regular player from viewing tournament player profiles', async () => {
    await expect(service.getPlayerProfile(player, 'tour-1', 'target-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows Club Manager to view a player on any team', async () => {
    const profile = await service.getPlayerProfile(clubManager, 'tour-1', 'target-1');

    expect(profile.firstName).toBe('Ravi');
    expect(profile.teamId).toBe('team-away');
  });

  it('rejects when the target is not rostered in the tournament', async () => {
    prisma.teamMembership.findFirst.mockResolvedValue(null);

    await expect(service.getPlayerProfile(captain, 'tour-1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('TeamsService removePlayerFromTeam', () => {
  const centerSevak: AuthUser = {
    ...player,
    id: 'sevak-1',
    role: UserRole.CenterSevak,
  };

  function buildFixture(options: { blockingSquad?: boolean } = {}) {
    const prisma = {
      tournament: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tour-1',
          name: 'Center Cup',
          isDeleted: false,
          type: TournamentType.Center,
        }),
      },
      tournamentCenter: {
        count: jest.fn().mockResolvedValue(2),
        findFirst: jest.fn().mockResolvedValue({ centerId: 'center-A' }),
      },
      team: {
        findFirst: jest.fn().mockResolvedValue({ id: 'team-1', name: 'Atmiya XI' }),
      },
      teamMembership: {
        findFirst: jest.fn().mockResolvedValue({ id: 'membership-1' }),
        update: jest.fn().mockResolvedValue({ id: 'membership-1' }),
      },
      matchSquadPlayer: {
        findFirst: jest
          .fn()
          .mockResolvedValue(options.blockingSquad ? { id: 'squad-player-1' } : null),
      },
      roleAssignment: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    const permissions = { check: jest.fn().mockResolvedValue(false) };
    const tournaments = {
      resolveCenterSevakCenterIds: jest.fn().mockResolvedValue(['center-A']),
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const notifications = { sendNotification: jest.fn().mockResolvedValue(undefined) };
    const service = new TeamsService(
      prisma as never,
      permissions as never,
      { deleteObject: jest.fn() } as never,
      { resolveReadUrl: jest.fn(), resolveReadUrls: jest.fn() } as never,
      tournaments as never,
      { assertCanViewCenterLevelTournament: jest.fn().mockResolvedValue(undefined) } as never,
      { buildCareerStats: jest.fn() } as never,
      audit as never,
      notifications as never,
    );
    return { service, prisma, audit, notifications };
  }

  it('allows an involved Center Sevak for a multi-center Center tournament', async () => {
    const { service, prisma, audit, notifications } = buildFixture();

    await service.removePlayerFromTeam(centerSevak, 'tour-1', 'team-1', 'player-2');

    expect(prisma.teamMembership.update).toHaveBeenCalledWith({
      where: { id: 'membership-1' },
      data: { isDeleted: true, deletedAt: expect.any(Date), deletedByUserId: 'sevak-1' },
    });
    expect(prisma.roleAssignment.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'player-2',
        tournamentId: 'tour-1',
        teamId: 'team-1',
        role: { in: [UserRole.Captain, UserRole.ViceCaptain, UserRole.Manager] },
      },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'TEAM_PLAYER_REMOVED' }),
    );
    expect(notifications.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ triggerKey: 'PLAYER_REMOVED_FROM_TEAM' }),
    );
  });

  it('blocks removal when the player is in an upcoming or live match squad', async () => {
    const { service, prisma } = buildFixture({ blockingSquad: true });

    await expect(
      service.removePlayerFromTeam(centerSevak, 'tour-1', 'team-1', 'player-2'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ error: 'PLAYER_IN_ACTIVE_MATCH_SQUAD' }),
    });
    expect(prisma.teamMembership.update).not.toHaveBeenCalled();
  });
});

describe('TeamsService assignTeamRoles', () => {
  let service: TeamsService;
  let prisma: {
    tournament: { findUnique: jest.Mock };
    team: { findFirst: jest.Mock };
    roleAssignment: {
      findMany: jest.Mock;
      deleteMany: jest.Mock;
      create: jest.Mock;
    };
    teamMembership: { findMany: jest.Mock; upsert: jest.Mock };
    tournamentCenter: { findMany: jest.Mock };
    user: { findMany: jest.Mock };
    registration: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let permissions: { check: jest.Mock };
  let audit: { record: jest.Mock };

  beforeEach(() => {
    prisma = {
      tournament: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tour-1',
          isDeleted: false,
          ballType: BallType.Tennis,
          provinceId: 'prov-1',
          type: TournamentType.APL,
          createdByUserId: 'admin-1',
          registrationOpenAt: new Date('2026-01-01T00:00:00.000Z'),
          registrationCloseAt: new Date('2026-01-15T00:00:00.000Z'),
        }),
      },
      team: {
        findFirst: jest.fn().mockResolvedValue({ id: 'team-1' }),
      },
      roleAssignment: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ userId: 'player-2', role: UserRole.ViceCaptain }]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({}),
      },
      teamMembership: {
        findMany: jest.fn().mockResolvedValue([{ userId: 'player-2', teamId: 'team-1' }]),
        upsert: jest.fn().mockResolvedValue({}),
      },
      tournamentCenter: {
        findMany: jest.fn().mockResolvedValue([{ centerId: 'center-A' }]),
      },
      user: {
        findMany: jest.fn().mockImplementation(async (args: { where: { id?: { in: string[] }; centerId?: { in: string[] } } }) => {
          if (args.where.id?.in) {
            return args.where.id.in.map((id) => ({ id }));
          }
          if (args.where.centerId?.in) {
            return [{ id: 'player-2' }];
          }
          return [];
        }),
      },
      registration: {
        findMany: jest.fn().mockResolvedValue([{ userId: 'player-2' }]),
      },
      $transaction: jest.fn(async (fn: (tx: typeof prisma) => Promise<void>) => fn(prisma)),
    };
    permissions = {
      check: jest.fn().mockResolvedValue(true),
    };
    audit = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    service = new TeamsService(
      prisma as unknown as PrismaService,
      permissions as unknown as PermissionService,
      { deleteObject: jest.fn() } as never,
      {
        resolveReadUrl: jest.fn(async (value: string | null) => value),
        resolveReadUrls: jest.fn(async (values: (string | null)[]) => values),
      } as never,
      { assertCenterSevakTournamentAccess: jest.fn() } as never,
      { assertCanViewCenterLevelTournament: jest.fn().mockResolvedValue(undefined) } as never,
      { buildCareerStats: jest.fn() } as never,
      audit as never,
      { sendNotification: jest.fn(), sendToAudience: jest.fn() } as never,
    );
  });

  it('allows a Club Manager to assign a Vice-Captain', async () => {
    prisma.roleAssignment.findMany.mockReset();
    prisma.roleAssignment.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ userId: 'player-2', role: UserRole.ViceCaptain }]);

    const result = await service.assignTeamRoles(clubManager, 'tour-1', 'team-1', {
      viceCaptainUserId: 'player-2',
    });

    expect(result.viceCaptainUserId).toBe('player-2');
    expect(prisma.roleAssignment.create).toHaveBeenCalledWith({
      data: {
        userId: 'player-2',
        role: UserRole.ViceCaptain,
        tournamentId: 'tour-1',
        teamId: 'team-1',
      },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'TEAM_ROLES_ASSIGNED',
        actorUserId: clubManager.id,
        targetEntityId: 'team-1',
      }),
    );
  });

  it('auto-rosters an eligible unrostered player then assigns the role', async () => {
    prisma.roleAssignment.findMany.mockReset();
    prisma.roleAssignment.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ userId: 'player-2', role: UserRole.Captain }]);
    // assertEligible: on-this-team check (empty) + ensureUsersRosteredOnTeam (empty → upsert)
    prisma.teamMembership.findMany
      .mockResolvedValueOnce([]) // assertEligible on-this-team
      .mockResolvedValueOnce([]); // ensureUsers — not yet rostered
    prisma.user.findMany.mockImplementation(async (args: { where: { id?: { in: string[] }; centerId?: { in: string[] } } }) => {
      if (args.where.id?.in) {
        return args.where.id.in.map((id) => ({ id }));
      }
      if (args.where.centerId?.in) {
        return [{ id: 'player-2' }];
      }
      return [];
    });
    prisma.registration.findMany.mockResolvedValue([{ userId: 'player-2' }]);

    const result = await service.assignTeamRoles(clubManager, 'tour-1', 'team-1', {
      captainUserId: 'player-2',
    });

    expect(result.captainUserId).toBe('player-2');
    expect(prisma.teamMembership.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tournamentId_userId: { tournamentId: 'tour-1', userId: 'player-2' } },
        create: expect.objectContaining({
          tournamentId: 'tour-1',
          teamId: 'team-1',
          userId: 'player-2',
        }),
      }),
    );
  });

  it('rejects auto-roster when the player is active on a different team', async () => {
    prisma.roleAssignment.findMany.mockReset();
    prisma.roleAssignment.findMany.mockResolvedValue([]);
    prisma.teamMembership.findMany
      .mockResolvedValueOnce([]) // assertEligible — not on this team
      .mockResolvedValueOnce([{ userId: 'player-2', teamId: 'team-other' }]); // ensureUsers
    prisma.user.findMany.mockImplementation(async (args: { where: { id?: { in: string[] }; centerId?: { in: string[] } } }) => {
      if (args.where.id?.in) {
        return args.where.id.in.map((id) => ({ id }));
      }
      if (args.where.centerId?.in) {
        return [{ id: 'player-2' }];
      }
      return [];
    });

    await expect(
      service.assignTeamRoles(clubManager, 'tour-1', 'team-1', { captainUserId: 'player-2' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.teamMembership.upsert).not.toHaveBeenCalled();
  });

  it('rejects when the Club Manager lacks permission', async () => {
    permissions.check.mockResolvedValue(false);

    await expect(
      service.assignTeamRoles(player, 'tour-1', 'team-1', { viceCaptainUserId: 'player-2' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects assigning the same person as Captain and Vice-Captain', async () => {
    prisma.roleAssignment.findMany.mockReset();
    prisma.roleAssignment.findMany.mockResolvedValue([
      { userId: 'player-1', role: UserRole.Captain },
    ]);

    await expect(
      service.assignTeamRoles(clubManager, 'tour-1', 'team-1', { viceCaptainUserId: 'player-1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects assigning Manager on ACC leather tournaments', async () => {
    prisma.tournament.findUnique.mockResolvedValue({
      id: 'tour-1',
      isDeleted: false,
      ballType: BallType.Leather,
      provinceId: 'prov-1',
      type: TournamentType.ACC,
      createdByUserId: 'admin-1',
      registrationOpenAt: new Date('2026-01-01T00:00:00.000Z'),
      registrationCloseAt: new Date('2026-01-15T00:00:00.000Z'),
    });

    await expect(
      service.assignTeamRoles(clubManager, 'tour-1', 'team-1', { managerUserId: 'player-2' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects assigning the same person as Captain and Manager', async () => {
    prisma.tournament.findUnique.mockResolvedValue({
      id: 'tour-1',
      isDeleted: false,
      ballType: BallType.Tennis,
      provinceId: 'prov-1',
      type: TournamentType.APL,
      createdByUserId: 'admin-1',
      registrationOpenAt: new Date('2026-01-01T00:00:00.000Z'),
      registrationCloseAt: new Date('2026-01-15T00:00:00.000Z'),
    });
    prisma.roleAssignment.findMany.mockReset();
    prisma.roleAssignment.findMany.mockResolvedValue([
      { userId: 'player-1', role: UserRole.Captain },
    ]);

    await expect(
      service.assignTeamRoles(clubManager, 'tour-1', 'team-1', { managerUserId: 'player-1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when the team is missing', async () => {
    prisma.team.findFirst.mockResolvedValue(null);

    await expect(
      service.assignTeamRoles(clubManager, 'tour-1', 'team-1', { viceCaptainUserId: 'player-2' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('TeamsService create (no create-time Cap/VC/Manager)', () => {
  let service: TeamsService;
  let prisma: {
    tournament: { findUnique: jest.Mock };
    team: { count: jest.Mock; create: jest.Mock };
  };
  let permissions: { check: jest.Mock };
  let tournaments: { assertCenterSevakTournamentAccess: jest.Mock };

  beforeEach(() => {
    prisma = {
      tournament: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tour-1',
          isDeleted: false,
          ballType: BallType.Leather,
          provinceId: 'prov-1',
          numberOfTeams: 4,
          type: TournamentType.ACC,
          createdByUserId: 'admin-1',
        }),
      },
      team: {
        count: jest.fn().mockResolvedValue(1),
        create: jest.fn().mockResolvedValue({
          id: 'team-new',
          tournamentId: 'tour-1',
          name: 'New Team',
          logoUrl: null,
          _count: { memberships: 0 },
        }),
      },
    };
    permissions = {
      check: jest.fn().mockResolvedValue(true),
    };
    tournaments = {
      assertCenterSevakTournamentAccess: jest.fn(),
    };

    service = new TeamsService(
      prisma as unknown as PrismaService,
      permissions as unknown as PermissionService,
      { deleteObject: jest.fn() } as never,
      {
        resolveReadUrl: jest.fn(async (value: string | null) => value),
        resolveReadUrls: jest.fn(async (values: (string | null)[]) => values),
      } as never,
      tournaments as never,
      { assertCanViewCenterLevelTournament: jest.fn().mockResolvedValue(undefined) } as never,
      { buildCareerStats: jest.fn() } as never,
      { record: jest.fn() } as never,
      { sendNotification: jest.fn(), sendToAudience: jest.fn() } as never,
    );

    jest.spyOn(service, 'assertTeamNameAvailable').mockResolvedValue(undefined);
  });

  it('creates a team without leadership fields', async () => {
    const summary = await service.create(clubManager, 'tour-1', {
      name: 'New Team',
    });

    expect(summary.name).toBe('New Team');
    expect(permissions.check).toHaveBeenCalledWith(
      Permission.EDIT_TOURNAMENT,
      clubManager,
      { tournamentId: 'tour-1' },
    );
  });
});

describe('TeamsService listRoleCandidates', () => {
  let service: TeamsService;
  let prisma: {
    tournament: { findUnique: jest.Mock };
    teamMembership: { findMany: jest.Mock };
    registration: { findMany: jest.Mock; count: jest.Mock };
    tournamentCenter: { findMany: jest.Mock };
  };
  let permissions: { check: jest.Mock };

  function buildService(): TeamsService {
    return new TeamsService(
      prisma as unknown as PrismaService,
      permissions as unknown as PermissionService,
      { deleteObject: jest.fn() } as never,
      {
        resolveReadUrl: jest.fn(async (value: string | null) => value),
        resolveReadUrls: jest.fn(async (values: (string | null)[]) => values),
      } as never,
      { assertCenterSevakTournamentAccess: jest.fn() } as never,
      { assertCanViewCenterLevelTournament: jest.fn().mockResolvedValue(undefined) } as never,
      { buildCareerStats: jest.fn() } as never,
      { record: jest.fn() } as never,
      { sendNotification: jest.fn(), sendToAudience: jest.fn() } as never,
    );
  }

  beforeEach(() => {
    permissions = {
      check: jest.fn().mockResolvedValue(true),
    };
  });

  it('returns confirmed registrants including rostered players', async () => {
    prisma = {
      tournament: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tour-1',
          isDeleted: false,
          ballType: BallType.Tennis,
          provinceId: 'prov-1',
          type: TournamentType.APL,
          createdByUserId: 'admin-1',
          registrationOpenAt: new Date('2026-01-01T00:00:00.000Z'),
          registrationCloseAt: new Date('2026-01-15T00:00:00.000Z'),
        }),
      },
      teamMembership: {
        findMany: jest.fn().mockResolvedValue([{ userId: 'rostered-1' }]),
      },
      registration: {
        count: jest.fn().mockResolvedValue(2),
        findMany: jest.fn().mockResolvedValue([
          {
            userId: 'rostered-1',
            user: {
              id: 'rostered-1',
              firstName: 'Ro',
              lastName: 'Ster',
              centerId: 'center-A',
              center: { id: 'center-A', name: 'Brampton' },
            },
            center: { id: 'center-A', name: 'Brampton' },
          },
          {
            userId: 'player-2',
            user: {
              id: 'player-2',
              firstName: 'Priya',
              lastName: 'Shah',
              centerId: 'center-A',
              center: { id: 'center-A', name: 'Brampton' },
            },
            center: { id: 'center-A', name: 'Brampton' },
          },
        ]),
      },
      tournamentCenter: {
        findMany: jest.fn().mockResolvedValue([{ centerId: 'center-A' }]),
      },
    };
    service = buildService();

    const result = await service.listRoleCandidates(clubManager, 'tour-1');

    expect(result.confirmedRegistrantCount).toBe(2);
    expect(result.rosteredCount).toBe(1);
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates.map((c) => c.userId).sort()).toEqual(['player-2', 'rostered-1']);
  });

  it('rejects candidates when registration is still open', async () => {
    prisma = {
      tournament: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tour-1',
          isDeleted: false,
          ballType: BallType.Tennis,
          type: TournamentType.APL,
          createdByUserId: 'admin-1',
          registrationOpenAt: new Date('2099-01-01T00:00:00.000Z'),
          registrationCloseAt: new Date('2099-12-31T00:00:00.000Z'),
        }),
      },
      teamMembership: { findMany: jest.fn() },
      registration: { findMany: jest.fn(), count: jest.fn() },
      tournamentCenter: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = buildService();

    await expect(service.listRoleCandidates(clubManager, 'tour-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});

describe('TeamsService update/remove EDIT_TOURNAMENT gate', () => {
  const centerSevak: AuthUser = {
    ...clubManager,
    id: 'sevak-1',
    role: UserRole.CenterSevak,
    centerSevakCenterIds: ['center-A'],
  };

  let service: TeamsService;
  let prisma: {
    tournament: { findUnique: jest.Mock };
    team: { findFirst: jest.Mock; update: jest.Mock };
    match: { findMany: jest.Mock };
    teamMembership: { deleteMany: jest.Mock };
    roleAssignment: { deleteMany: jest.Mock };
    teamRegistrationFavourite: { deleteMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let permissions: { check: jest.Mock };
  let tournaments: { assertCenterSevakTournamentAccess: jest.Mock };

  function buildService(): TeamsService {
    return new TeamsService(
      prisma as unknown as PrismaService,
      permissions as unknown as PermissionService,
      { deleteObject: jest.fn() } as never,
      {
        resolveReadUrl: jest.fn(async (value: string | null) => value),
        resolveReadUrls: jest.fn(async (values: (string | null)[]) => values),
      } as never,
      tournaments as never,
      { assertCanViewCenterLevelTournament: jest.fn().mockResolvedValue(undefined) } as never,
      { buildCareerStats: jest.fn() } as never,
      { record: jest.fn() } as never,
      { sendNotification: jest.fn(), sendToAudience: jest.fn() } as never,
    );
  }

  beforeEach(() => {
    prisma = {
      tournament: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tour-1',
          isDeleted: false,
          type: TournamentType.Center,
          createdByUserId: 'admin-1',
          ballType: BallType.Tennis,
          numberOfTeams: 8,
        }),
      },
      team: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'team-1',
            name: 'Titans',
            nameNormalized: 'titans',
            logoUrl: null,
          })
          .mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({
          id: 'team-1',
          tournamentId: 'tour-1',
          name: 'Titans XI',
          logoUrl: null,
          group: null,
          _count: { memberships: 0 },
        }),
      },
      match: { findMany: jest.fn().mockResolvedValue([]) },
      teamMembership: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      roleAssignment: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      teamRegistrationFavourite: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      $transaction: jest.fn(async (ops: unknown) => ops),
    };
    permissions = {
      check: jest.fn().mockResolvedValue(true),
    };
    tournaments = {
      assertCenterSevakTournamentAccess: jest.fn().mockResolvedValue(undefined),
    };
    service = buildService();
  });

  it('allows a participating Center Sevak to update a team when EDIT_TOURNAMENT passes', async () => {
    const result = await service.update(centerSevak, 'tour-1', 'team-1', {
      name: 'Titans XI',
    });

    expect(result.name).toBe('Titans XI');
    expect(permissions.check).toHaveBeenCalledWith(Permission.EDIT_TOURNAMENT, centerSevak, {
      tournamentId: 'tour-1',
    });
    expect(tournaments.assertCenterSevakTournamentAccess).toHaveBeenCalled();
  });

  it('allows a participating Center Sevak to delete a team when EDIT_TOURNAMENT passes', async () => {
    prisma.team.findFirst.mockReset();
    prisma.team.findFirst.mockResolvedValue({
      id: 'team-1',
      name: 'Titans',
      nameNormalized: 'titans',
      logoUrl: null,
    });

    await service.remove(centerSevak, 'tour-1', 'team-1');

    expect(permissions.check).toHaveBeenCalledWith(Permission.EDIT_TOURNAMENT, centerSevak, {
      tournamentId: 'tour-1',
    });
    expect(tournaments.assertCenterSevakTournamentAccess).toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('rejects update when EDIT_TOURNAMENT is denied (non-participating Sevak)', async () => {
    permissions.check.mockResolvedValue(false);

    await expect(
      service.update(centerSevak, 'tour-1', 'team-1', { name: 'Nope' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tournaments.assertCenterSevakTournamentAccess).not.toHaveBeenCalled();
  });

  it('rejects remove when EDIT_TOURNAMENT is denied', async () => {
    permissions.check.mockResolvedValue(false);

    await expect(service.remove(centerSevak, 'tour-1', 'team-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
