import 'reflect-metadata';

import {
  formatGroupDeleteBlockedMessage,
  GROUP_FORM_MESSAGES,
  MatchSchedulingFormat,
  TournamentType,
  type AuthUser,
  UserRole,
} from '@acc/types';

import { GroupsService } from './groups.service';

const manager: AuthUser = {
  id: 'mgr-1',
  firstName: 'Club',
  lastName: 'Manager',
  mobileNumber: '+15555550002',
  email: 'cm@acc.local',
  centerId: 'center-A',
  jerseyNumber: 2,
  profilePhotoUrl: null,
  role: UserRole.ClubManager,
  isActive: true,
  teamLeadAssignments: [],
};

const TEAM_ID = '0b0f4a8e-7c1d-4e0a-9f3b-2d5c6e7f8a9b';

describe('group-match-query blocking semantics', () => {
  it('treats fixtures as blocking only when a participating team remains in the group', () => {
    const divisionE = '066a3ecf-a2a1-4321-826c-acd2eb729945';
    const divisionA = '51bb57f8-9c36-4303-b8df-fadc27cacc82';

    const match = {
      groupId: divisionE,
      homeTeam: { groupId: divisionA },
      awayTeam: { groupId: divisionA },
    };

    const homeInGroup = match.homeTeam?.groupId === match.groupId;
    const awayInGroup = match.awayTeam?.groupId === match.groupId;

    expect(homeInGroup || awayInGroup).toBe(false);
  });
});

describe('GroupsService.remove', () => {
  let service: GroupsService;
  let prisma: {
    tournament: { findUnique: jest.Mock; update: jest.Mock };
    tournamentGroup: { findFirst: jest.Mock; delete: jest.Mock; count: jest.Mock };
    match: { count: jest.Mock; updateMany: jest.Mock; findMany: jest.Mock };
    team: { updateMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let permissions: { check: jest.Mock };
  let tournaments: { assertCenterSevakTournamentAccess: jest.Mock };

  beforeEach(() => {
    prisma = {
      tournament: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tour-1',
          type: 'Center',
          matchSchedulingFormat: 'GroupStageKnockout',
          isDeleted: false,
          _count: { groups: 2 },
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      tournamentGroup: {
        findFirst: jest.fn().mockResolvedValue({ id: 'group-1' }),
        delete: jest.fn(),
        count: jest.fn().mockResolvedValue(1),
      },
      match: {
        count: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      team: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      $transaction: jest.fn(async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)),
    };
    permissions = { check: jest.fn().mockResolvedValue(true) };
    tournaments = { assertCenterSevakTournamentAccess: jest.fn().mockResolvedValue(undefined) };

    service = new GroupsService(
      prisma as never,
      permissions as never,
      tournaments as never,
      { invalidateTournamentAggregates: jest.fn().mockResolvedValue(undefined) } as never,
    );
  });

  it('allows delete when only orphaned fixtures remain (teams moved to another group)', async () => {
    prisma.match.count.mockResolvedValue(0);

    await service.remove(manager, 'tour-1', 'group-1');

    expect(prisma.match.updateMany).toHaveBeenCalled();
    expect(prisma.tournamentGroup.delete).toHaveBeenCalledWith({ where: { id: 'group-1' } });
  });

  it('blocks deletion when a participating team still belongs to the group', async () => {
    prisma.match.count.mockResolvedValue(1);

    await expect(service.remove(manager, 'tour-1', 'group-1')).rejects.toMatchObject({
      response: {
        message: formatGroupDeleteBlockedMessage(1),
        error: 'GROUP_HAS_MATCHES',
      },
    });
    expect(prisma.tournamentGroup.delete).not.toHaveBeenCalled();
  });

  it('clears Group Stage + Knockout when the last group is deleted', async () => {
    prisma.tournament.findUnique.mockResolvedValue({
      id: 'tour-1',
      type: TournamentType.Center,
      matchSchedulingFormat: MatchSchedulingFormat.GroupStageKnockout,
      isDeleted: false,
      _count: { groups: 1 },
    });
    prisma.match.count.mockResolvedValue(0);
    prisma.tournamentGroup.count.mockResolvedValue(0);

    await service.remove(manager, 'tour-1', 'group-1');

    expect(prisma.tournament.update).toHaveBeenCalledWith({
      where: { id: 'tour-1' },
      data: { matchSchedulingFormat: null },
    });
  });

  it('keeps the format while other groups remain', async () => {
    prisma.match.count.mockResolvedValue(0);
    prisma.tournamentGroup.count.mockResolvedValue(1);

    await service.remove(manager, 'tour-1', 'group-1');

    expect(prisma.tournament.update).not.toHaveBeenCalled();
  });

  it('keeps the format when the last group is deleted but the tournament still has matches', async () => {
    prisma.tournament.findUnique.mockResolvedValue({
      id: 'tour-1',
      type: TournamentType.Center,
      matchSchedulingFormat: MatchSchedulingFormat.GroupStageKnockout,
      isDeleted: false,
      _count: { groups: 1 },
    });
    prisma.match.count.mockResolvedValueOnce(0).mockResolvedValueOnce(3);
    prisma.tournamentGroup.count.mockResolvedValue(0);

    await service.remove(manager, 'tour-1', 'group-1');

    expect(prisma.tournamentGroup.delete).toHaveBeenCalled();
    expect(prisma.tournament.update).not.toHaveBeenCalled();
  });

  it('rejects deleting a locked group (a match involves one of its teams)', async () => {
    prisma.match.count.mockResolvedValue(0);
    prisma.match.findMany.mockResolvedValue([
      { homeTeam: { groupId: 'group-1' }, awayTeam: { groupId: 'group-2' } },
    ]);

    await expect(service.remove(manager, 'tour-1', 'group-1')).rejects.toMatchObject({
      response: { error: 'GROUP_LOCKED', message: GROUP_FORM_MESSAGES.locked },
    });
    expect(prisma.tournamentGroup.delete).not.toHaveBeenCalled();
  });
});

describe('GroupsService.update', () => {
  function setup(lockingMatches: unknown[] = []) {
    const tx = {
      tournamentGroup: { update: jest.fn().mockResolvedValue({}) },
      team: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma = {
      tournament: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tour-1',
          type: TournamentType.Center,
          ballType: 'TENNIS',
          matchSchedulingFormat: MatchSchedulingFormat.GroupStageKnockout,
          isDeleted: false,
          _count: { groups: 2 },
        }),
      },
      tournamentGroup: {
        findFirst: jest
          .fn()
          .mockImplementation(({ where }: { where: { id?: string; nameNormalized?: string } }) =>
            Promise.resolve(where.nameNormalized ? null : { id: 'group-1', name: 'Group A' }),
          ),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'group-1',
          tournamentId: 'tour-1',
          name: 'Group B',
          teams: [],
        }),
      },
      team: { findMany: jest.fn().mockResolvedValue([{ id: TEAM_ID, groupId: null, group: null }]) },
      match: {
        findMany: jest.fn().mockResolvedValue(lockingMatches),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    };
    const service = new GroupsService(
      prisma as never,
      { check: jest.fn().mockResolvedValue(true) } as never,
      { assertCenterSevakTournamentAccess: jest.fn().mockResolvedValue(undefined) } as never,
      { invalidateTournamentAggregates: jest.fn().mockResolvedValue(undefined) } as never,
    );
    return { service, tx };
  }

  it('renames the group and adds unassigned teams in one transaction', async () => {
    const { service, tx } = setup();

    await service.update(manager, 'tour-1', 'group-1', { name: ' Group B ', addTeamIds: [TEAM_ID] });

    expect(tx.tournamentGroup.update).toHaveBeenCalledWith({
      where: { id: 'group-1' },
      data: { name: 'Group B', nameNormalized: 'group b' },
    });
    expect(tx.team.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { groupId: 'group-1' } }),
    );
  });

  it('rejects edits once a match involves one of the group teams', async () => {
    const { service, tx } = setup([{ homeTeam: { groupId: 'group-1' }, awayTeam: null }]);

    await expect(
      service.update(manager, 'tour-1', 'group-1', { name: 'Group B' }),
    ).rejects.toMatchObject({ response: { error: 'GROUP_LOCKED' } });
    expect(tx.tournamentGroup.update).not.toHaveBeenCalled();
  });
});

describe('GroupsService.create', () => {
  function setup(tournament: Record<string, unknown>) {
    const tx = {
      tournamentGroup: {
        create: jest.fn().mockResolvedValue({ id: 'group-1' }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'group-1',
          tournamentId: 'tour-1',
          name: 'Group A',
          teams: [],
        }),
      },
      tournament: { update: jest.fn().mockResolvedValue({}) },
      team: { updateMany: jest.fn() },
    };
    const prisma = {
      tournament: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tour-1',
          isDeleted: false,
          _count: { groups: 0 },
          ...tournament,
        }),
      },
      tournamentGroup: { findFirst: jest.fn().mockResolvedValue(null) },
      match: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    };
    const service = new GroupsService(
      prisma as never,
      { check: jest.fn().mockResolvedValue(true) } as never,
      { assertCenterSevakTournamentAccess: jest.fn().mockResolvedValue(undefined) } as never,
      { invalidateTournamentAggregates: jest.fn().mockResolvedValue(undefined) } as never,
    );
    return { service, tx };
  }

  it('finalizes Group Stage + Knockout with the first group from the schedule flow', async () => {
    const { service, tx } = setup({
      type: TournamentType.Center,
      matchSchedulingFormat: null,
    });

    await service.create(manager, 'tour-1', {
      name: 'Group A',
      schedulingFormat: MatchSchedulingFormat.GroupStageKnockout,
    });

    expect(tx.tournament.update).toHaveBeenCalledWith({
      where: { id: 'tour-1' },
      data: { matchSchedulingFormat: MatchSchedulingFormat.GroupStageKnockout },
    });
  });

  it('finalizes the first group without the intent when no format is set (older app builds)', async () => {
    const { service, tx } = setup({
      type: TournamentType.Center,
      matchSchedulingFormat: null,
    });

    await service.create(manager, 'tour-1', { name: 'Group A' });

    expect(tx.tournament.update).toHaveBeenCalledWith({
      where: { id: 'tour-1' },
      data: { matchSchedulingFormat: MatchSchedulingFormat.GroupStageKnockout },
    });
  });

  it('rejects a Center-level first group when another format is already chosen', async () => {
    const { service, tx } = setup({
      type: TournamentType.Center,
      matchSchedulingFormat: MatchSchedulingFormat.RoundRobin,
    });

    await expect(service.create(manager, 'tour-1', { name: 'Group A' })).rejects.toMatchObject({
      response: { error: 'INVALID_SCHEDULING_FORMAT' },
    });
    expect(tx.tournamentGroup.create).not.toHaveBeenCalled();
  });

  it('leaves the format alone when groups already exist', async () => {
    const { service, tx } = setup({
      type: TournamentType.APL,
      matchSchedulingFormat: MatchSchedulingFormat.GroupStageKnockout,
      _count: { groups: 2 },
    });

    await service.create(manager, 'tour-1', { name: 'Group C' });

    expect(tx.tournament.update).not.toHaveBeenCalled();
  });
});
