import { BallType, MatchState, UserRole, type AuthUser } from '@acc/types';
import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AuditService } from '../audit/audit.service';
import { PermissionService } from '../authz/permission.service';
import { LateArrivalPenaltyService } from '../late-arrival-penalty/late-arrival-penalty.service';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceService } from './attendance.service';

jest.mock('../authz/team-leader.util', () => ({
  isCaptainOrViceCaptain: jest.fn(),
}));

import { isCaptainOrViceCaptain } from '../authz/team-leader.util';

describe('AttendanceService punch time access', () => {
  let service: AttendanceService;
  const isCaptainMock = isCaptainOrViceCaptain as jest.MockedFunction<typeof isCaptainOrViceCaptain>;

  const prismaMock = {
    match: { findFirst: jest.fn() },
    matchSquad: { findUnique: jest.fn() },
    matchSquadPlayer: { findMany: jest.fn() },
    matchAttendancePunch: { findMany: jest.fn() },
    roleAssignment: { findFirst: jest.fn() },
  };
  const penalties = {
    evaluateNoShowServes: jest.fn().mockResolvedValue(undefined),
    loadDesignatedServers: jest.fn().mockResolvedValue([]),
  };
  const permissions = { check: jest.fn() };
  const audit = { record: jest.fn() };

  const liveMatch = {
    id: 'match-1',
    state: MatchState.Live,
    reportingTime: new Date('2026-06-01T13:00:00Z'),
    homeTeamId: 'team-a',
    awayTeamId: 'team-b',
    externalOpponentName: null,
    tournamentId: 'tournament-1',
    homeTeam: { id: 'team-a', name: 'ACC 3' },
    awayTeam: { id: 'team-b', name: 'ACC 6' },
    tournament: { id: 'tournament-1', name: 'ACC 2026', ballType: BallType.Leather, timezone: 'America/Toronto' },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: PermissionService, useValue: permissions },
        { provide: AuditService, useValue: audit },
        { provide: LateArrivalPenaltyService, useValue: penalties },
      ],
    }).compile();
    service = module.get(AttendanceService);

    prismaMock.match.findFirst.mockResolvedValue(liveMatch);
    prismaMock.matchSquad.findUnique.mockResolvedValue({ players: [] });
    prismaMock.matchSquadPlayer.findMany.mockResolvedValue([]);
    prismaMock.matchAttendancePunch.findMany.mockResolvedValue([]);
  });

  it('allows admin to fetch either ACC team punch data', async () => {
    const admin = { id: 'admin-1', role: UserRole.Admin } as AuthUser;

    await expect(service.getPunchTimeView(admin, 'match-1', 'team-a')).resolves.toMatchObject({
      teamId: 'team-a',
    });
    await expect(service.getPunchTimeView(admin, 'match-1', 'team-b')).resolves.toMatchObject({
      teamId: 'team-b',
    });
    expect(isCaptainMock).not.toHaveBeenCalled();
  });

  it('blocks captain from fetching the other team punch data', async () => {
    isCaptainMock.mockResolvedValue(false);
    const captain = { id: 'captain-1', role: UserRole.Captain } as AuthUser;

    await expect(service.getPunchTimeView(captain, 'match-1', 'team-b')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows captain to fetch their own team punch data', async () => {
    isCaptainMock.mockResolvedValue(true);
    const captain = { id: 'captain-1', role: UserRole.Captain } as AuthUser;

    await expect(service.getPunchTimeView(captain, 'match-1', 'team-a')).resolves.toMatchObject({
      teamId: 'team-a',
    });
  });
});
