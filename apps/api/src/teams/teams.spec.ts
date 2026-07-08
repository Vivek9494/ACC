import 'reflect-metadata';

import {
  type AuthUser,
  BallType,
  Permission,
  UserRole,
  canViewTournamentPlayerProfiles,
} from '@acc/types';
import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';

import { PermissionService } from '../authz/permission.service';
import { PrismaService } from '../prisma/prisma.service';
import { TeamsService } from './teams.service';

const emptyCareerStats = {
  matches: 0,
  runs: 0,
  average: null,
  highestScore: null,
  highestScoreOpponent: null,
  highestScoreContext: null,
  strikeRate: null,
  wickets: 0,
  bestBowling: null,
  bestBowlingContext: null,
  catches: 0,
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
    teamMembership: { findMany: jest.Mock };
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
    expect(permissions.check).toHaveBeenCalledWith(
      Permission.ASSIGN_TEAM_ROLES,
      clubManager,
      { tournamentId: 'tour-1', teamId: 'team-1' },
    );
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

describe('TeamsService create with leadership roles', () => {
  let service: TeamsService;
  let prisma: {
    tournament: { findUnique: jest.Mock };
    team: { count: jest.Mock; create: jest.Mock };
    registration: { findMany: jest.Mock };
    teamMembership: { findMany: jest.Mock; create: jest.Mock };
    user: { findMany: jest.Mock };
    roleAssignment: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let permissions: { check: jest.Mock };
  let tournaments: { assertCenterSevakTournamentAccess: jest.Mock };
  let audit: { record: jest.Mock };

  beforeEach(() => {
    const tx = {
      team: {
        create: jest.fn().mockResolvedValue({
          id: 'team-new',
          tournamentId: 'tour-1',
          name: 'New Team',
          logoUrl: null,
          _count: { memberships: 2 },
        }),
      },
      registration: {
        findMany: jest.fn().mockResolvedValue([
          { userId: 'player-1', playerType: 'FULL_TIME' },
          { userId: 'player-2', playerType: 'PART_TIME' },
        ]),
      },
      teamMembership: {
        create: jest.fn().mockResolvedValue({}),
      },
      roleAssignment: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    prisma = {
      tournament: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tour-1',
          isDeleted: false,
          ballType: BallType.Leather,
          numberOfTeams: 4,
        }),
      },
      team: {
        count: jest.fn().mockResolvedValue(1),
        create: tx.team.create,
      },
      registration: {
        findMany: jest.fn().mockResolvedValue([
          { userId: 'player-1' },
          { userId: 'player-2' },
        ]),
      },
      teamMembership: {
        findMany: jest.fn().mockResolvedValue([]),
        create: tx.teamMembership.create,
      },
      user: {
        findMany: jest.fn().mockImplementation(async ({ where }: { where: { id: { in: string[] } } }) =>
          where.id.in.map((id) => ({ id })),
        ),
      },
      roleAssignment: {
        create: tx.roleAssignment.create,
      },
      $transaction: jest.fn(async (fn: (inner: typeof tx) => Promise<unknown>) => fn(tx)),
    };
    permissions = {
      check: jest.fn().mockImplementation(async (permission: Permission) => {
        return (
          permission === Permission.EDIT_TOURNAMENT ||
          permission === Permission.ASSIGN_TEAM_ROLES
        );
      }),
    };
    tournaments = {
      assertCenterSevakTournamentAccess: jest.fn(),
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
      tournaments as never,
      { buildCareerStats: jest.fn() } as never,
      audit as never,
      { sendNotification: jest.fn(), sendToAudience: jest.fn() } as never,
    );

    jest.spyOn(service, 'assertTeamNameAvailable').mockResolvedValue(undefined);
  });

  it('creates a team with captain and vice-captain on the squad', async () => {
    const summary = await service.create(clubManager, 'tour-1', {
      name: 'New Team',
      captainUserId: 'player-1',
      viceCaptainUserId: 'player-2',
    });

    expect(summary.name).toBe('New Team');
    expect(prisma.teamMembership.create).toHaveBeenCalledTimes(2);
    expect(prisma.roleAssignment.create).toHaveBeenCalledTimes(2);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'TEAM_ROLES_ASSIGNED',
        targetEntityId: 'team-new',
      }),
    );
  });

  it('rejects duplicate leadership roles at create', async () => {
    await expect(
      service.create(clubManager, 'tour-1', {
        name: 'New Team',
        captainUserId: 'player-1',
        viceCaptainUserId: 'player-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when a selected player is already rostered elsewhere', async () => {
    prisma.teamMembership.findMany.mockResolvedValue([{ userId: 'player-1' }]);

    await expect(
      service.create(clubManager, 'tour-1', {
        name: 'New Team',
        captainUserId: 'player-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('TeamsService listRoleCandidates', () => {
  let service: TeamsService;
  let prisma: {
    tournament: { findUnique: jest.Mock };
    teamMembership: { findMany: jest.Mock };
    registration: { findMany: jest.Mock; count: jest.Mock };
  };
  let permissions: { check: jest.Mock };

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
        findMany: jest.fn().mockResolvedValue([{ userId: 'rostered-1' }]),
      },
      registration: {
        count: jest.fn().mockResolvedValue(2),
        findMany: jest.fn().mockResolvedValue([
          {
            userId: 'player-2',
            user: { id: 'player-2', firstName: 'Priya', lastName: 'Shah' },
            center: { name: 'Brampton' },
          },
        ]),
      },
    };
    permissions = {
      check: jest.fn().mockResolvedValue(true),
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
      { buildCareerStats: jest.fn() } as never,
      { record: jest.fn() } as never,
      { sendNotification: jest.fn(), sendToAudience: jest.fn() } as never,
    );
  });

  it('returns confirmed registrants not already on an active team', async () => {
    const result = await service.listRoleCandidates(clubManager, 'tour-1');

    expect(result).toEqual({
      candidates: [
        {
          userId: 'player-2',
          firstName: 'Priya',
          lastName: 'Shah',
          centerName: 'Brampton',
        },
      ],
      confirmedRegistrantCount: 2,
      rosteredCount: 1,
    });
    expect(prisma.teamMembership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tournamentId: 'tour-1',
          team: { deletedAt: null },
        }),
      }),
    );
    expect(prisma.registration.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tournamentId: 'tour-1',
          status: 'CONFIRMED',
        }),
      }),
    );
    expect(prisma.registration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tournamentId: 'tour-1',
          status: 'CONFIRMED',
          userId: { notIn: ['rostered-1'] },
        }),
      }),
    );
  });
});
