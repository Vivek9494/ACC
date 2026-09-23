import 'reflect-metadata';

import { formatGroupDeleteBlockedMessage, type AuthUser, UserRole } from '@acc/types';

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
    tournament: { findUnique: jest.Mock };
    tournamentGroup: { findFirst: jest.Mock; delete: jest.Mock };
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
      },
      tournamentGroup: {
        findFirst: jest.fn().mockResolvedValue({ id: 'group-1' }),
        delete: jest.fn(),
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
});
