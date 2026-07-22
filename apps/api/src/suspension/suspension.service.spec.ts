import {
  AttendancePunchStatus,
  BallType,
  MatchState,
  SuspensionReason,
  SuspensionStatus,
} from '@acc/types';
import { Test, TestingModule } from '@nestjs/testing';

import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { SuspensionService } from './suspension.service';

describe('SuspensionService', () => {
  let service: SuspensionService;
  const prismaMock = {
    match: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    availabilityPoll: { findUnique: jest.fn() },
    suspension: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    lateArrivalPenalty: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    lateArrivalPenaltyTransition: { create: jest.fn() },
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const notifications = { sendToAudience: jest.fn().mockResolvedValue({ sent: true }) };

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock.match.findFirst.mockResolvedValue(null);
    prismaMock.availabilityPoll.findUnique.mockResolvedValue(null);
    prismaMock.lateArrivalPenalty.findFirst.mockResolvedValue(null);
    prismaMock.lateArrivalPenalty.create.mockResolvedValue({ id: 'penalty-1' });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuspensionService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: audit },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();
    service = module.get(SuspensionService);
  });

  const completedMatch = {
    id: 'match-1',
    state: MatchState.Completed,
    startTime: new Date('2026-06-01T18:00:00Z'),
    completedAt: new Date('2026-06-01T22:00:00Z'),
    matchDate: new Date('2026-06-01'),
    homeTeamId: 'team-a',
    awayTeamId: null,
    tournamentId: 'tournament-1',
    tournament: { id: 'tournament-1', ballType: BallType.Leather },
    attendancePunches: [] as { userId: string; teamId: string; status: AttendancePunchStatus }[],
  };

  it('creates pending suspensions for late punches when a leather match completes', async () => {
    prismaMock.match.findUnique.mockResolvedValue({
      ...completedMatch,
      attendancePunches: [
        { userId: 'player-1', teamId: 'team-a', status: AttendancePunchStatus.Late },
      ],
    });
    prismaMock.suspension.findMany.mockResolvedValue([]);
    prismaMock.suspension.findFirst.mockResolvedValue(null);
    prismaMock.match.findFirst.mockResolvedValue({ id: 'match-2' });
    prismaMock.suspension.create.mockResolvedValue({ id: 'susp-1' });

    await service.generateForCompletedMatch('match-1');

    expect(prismaMock.suspension.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'player-1',
          teamId: 'team-a',
          triggeredByMatchId: 'match-1',
          servingMatchId: 'match-2',
          status: SuspensionStatus.Pending,
          reason: SuspensionReason.LateLastMatch,
        }),
      }),
    );
  });

  it('auto-carries the same suspension record when a serving player is late', async () => {
    prismaMock.match.findUnique.mockResolvedValue({
      ...completedMatch,
      id: 'match-2',
      attendancePunches: [
        { userId: 'player-1', teamId: 'team-a', status: AttendancePunchStatus.Late },
      ],
    });
    prismaMock.suspension.findMany.mockResolvedValue([
      {
        id: 'susp-1',
        userId: 'player-1',
        teamId: 'team-a',
        tournamentId: 'tournament-1',
        carryForwardCount: 0,
      },
    ]);
    prismaMock.match.findFirst.mockResolvedValue({ id: 'match-3' });
    prismaMock.suspension.findFirst.mockResolvedValue({ id: 'susp-1' });

    await service.generateForCompletedMatch('match-2');

    expect(prismaMock.suspension.update).toHaveBeenCalledWith({
      where: { id: 'susp-1' },
      data: {
        status: SuspensionStatus.Pending,
        servingMatchId: 'match-3',
        carryForwardCount: { increment: 1 },
      },
    });
    expect(prismaMock.suspension.create).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SUSPENSION_AUTO_CARRIED_FORWARD' }),
    );
  });

  it('discharges a serving suspension when the player punches on time', async () => {
    prismaMock.match.findUnique.mockResolvedValue({
      ...completedMatch,
      id: 'match-2',
      attendancePunches: [
        { userId: 'player-1', teamId: 'team-a', status: AttendancePunchStatus.OnTime },
      ],
    });
    prismaMock.suspension.findMany.mockResolvedValue([
      {
        id: 'susp-1',
        userId: 'player-1',
        teamId: 'team-a',
        tournamentId: 'tournament-1',
        carryForwardCount: 0,
      },
    ]);

    await service.generateForCompletedMatch('match-2');

    expect(prismaMock.suspension.update).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SUSPENSION_DISCHARGED' }),
    );
  });

  it('does not create a second suspension when a serving player is late (DP3)', async () => {
    prismaMock.match.findUnique.mockResolvedValue({
      ...completedMatch,
      id: 'match-2',
      attendancePunches: [
        { userId: 'player-1', teamId: 'team-a', status: AttendancePunchStatus.Late },
      ],
    });
    prismaMock.suspension.findMany.mockResolvedValue([
      {
        id: 'susp-1',
        userId: 'player-1',
        teamId: 'team-a',
        tournamentId: 'tournament-1',
        carryForwardCount: 0,
      },
    ]);
    prismaMock.match.findFirst.mockResolvedValue({ id: 'match-3' });
    prismaMock.suspension.findFirst.mockResolvedValue({ id: 'susp-1' });

    await service.generateForCompletedMatch('match-2');

    expect(prismaMock.suspension.create).not.toHaveBeenCalled();
  });

  it('marks only manually selected voted-IN suspensions as served on XI confirm', async () => {
    prismaMock.match.findUnique.mockResolvedValue({
      id: 'match-2',
      tournamentId: 'tournament-1',
      startTime: new Date('2026-06-08T18:00:00Z'),
      matchDate: new Date('2026-06-08'),
      tournament: { ballType: BallType.Leather },
    });
    prismaMock.match.findFirst.mockResolvedValue(null);
    prismaMock.availabilityPoll.findUnique.mockResolvedValue({
      votes: [{ userId: 'player-1', isAvailable: true }],
    });
    prismaMock.suspension.findMany.mockResolvedValue([
      {
        id: 'susp-1',
        userId: 'player-1',
        teamId: 'team-a',
        tournamentId: 'tournament-1',
        servingMatchId: 'match-2',
        triggeredByMatchId: 'match-1',
        carryForwardCount: 0,
      },
    ]);
    prismaMock.suspension.update.mockResolvedValue({});

    await service.resolveManualSuspensionsOnPlayingXiConfirm(
      'match-2',
      'team-a',
      ['player-1'],
      [],
    );

    expect(prismaMock.suspension.update).toHaveBeenCalledWith({
      where: { id: 'susp-1' },
      data: { status: SuspensionStatus.Served },
    });
    expect(prismaMock.lateArrivalPenalty.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        playerId: 'player-1',
        state: 'ASSIGNED',
        assignedServeMatchId: 'match-2',
      }),
    });
  });

  it('auto-carries an unchecked voted-IN suspension on XI confirm', async () => {
    const servingMatch = {
      id: 'match-2',
      tournamentId: 'tournament-1',
      startTime: new Date('2026-06-08T18:00:00Z'),
      matchDate: new Date('2026-06-08'),
      tournament: { ballType: BallType.Leather },
    };
    prismaMock.match.findUnique.mockImplementation(async (args: { where: { id: string } }) => {
      if (args.where.id === 'match-2') {
        return servingMatch;
      }
      return {
        id: 'match-2',
        startTime: new Date('2026-06-08T18:00:00Z'),
        matchDate: new Date('2026-06-08'),
        tournamentId: 'tournament-1',
      };
    });
    prismaMock.match.findFirst.mockResolvedValue({ id: 'match-3' });
    prismaMock.availabilityPoll.findUnique.mockResolvedValue({
      votes: [{ userId: 'player-2', isAvailable: true }],
    });
    prismaMock.suspension.findMany.mockResolvedValue([
      {
        id: 'susp-2',
        userId: 'player-2',
        teamId: 'team-a',
        tournamentId: 'tournament-1',
        servingMatchId: 'match-2',
        carryForwardCount: 0,
      },
    ]);
    prismaMock.suspension.update.mockResolvedValue({});

    await service.resolveManualSuspensionsOnPlayingXiConfirm('match-2', 'team-a', [], []);

    expect(prismaMock.suspension.update).toHaveBeenCalledWith({
      where: { id: 'susp-2' },
      data: {
        status: SuspensionStatus.CarriedForward,
        servingMatchId: 'match-3',
        actionedAtMatchId: 'match-2',
        carryForwardCount: { increment: 1 },
      },
    });
  });

  it('auto-carries no-vote pending suspensions on XI confirm (same as voted-OUT)', async () => {
    const servingMatch = {
      id: 'match-2',
      tournamentId: 'tournament-1',
      startTime: new Date('2026-06-08T18:00:00Z'),
      matchDate: new Date('2026-06-08'),
      tournament: { ballType: BallType.Leather },
    };
    prismaMock.match.findUnique.mockImplementation(async (args: { where: { id: string } }) => {
      if (args.where.id === 'match-2') {
        return servingMatch;
      }
      return {
        id: 'match-2',
        startTime: new Date('2026-06-08T18:00:00Z'),
        matchDate: new Date('2026-06-08'),
        tournamentId: 'tournament-1',
      };
    });
    prismaMock.match.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'match-3' });
    prismaMock.availabilityPoll.findUnique.mockResolvedValue({ votes: [] });
    prismaMock.suspension.findMany.mockResolvedValue([
      {
        id: 'susp-3',
        userId: 'player-3',
        teamId: 'team-a',
        tournamentId: 'tournament-1',
        servingMatchId: 'match-2',
        carryForwardCount: 0,
      },
    ]);
    prismaMock.suspension.update.mockResolvedValue({});

    await service.markRemainingPendingAsServed('match-2', 'team-a');

    expect(prismaMock.suspension.update).toHaveBeenCalledWith({
      where: { id: 'susp-3' },
      data: expect.objectContaining({
        status: SuspensionStatus.CarriedForward,
        servingMatchId: 'match-3',
        actionedAtMatchId: 'match-2',
      }),
    });
  });

  it('leaves unchecked suspensions pending when no future match exists on XI confirm', async () => {
    const servingMatch = {
      id: 'match-2',
      tournamentId: 'tournament-1',
      startTime: new Date('2026-06-08T18:00:00Z'),
      matchDate: new Date('2026-06-08'),
      tournament: { ballType: BallType.Leather },
    };
    prismaMock.match.findUnique.mockImplementation(async (args: { where: { id: string } }) => {
      if (args.where.id === 'match-2') {
        return servingMatch;
      }
      return {
        id: 'match-2',
        startTime: new Date('2026-06-08T18:00:00Z'),
        matchDate: new Date('2026-06-08'),
        tournamentId: 'tournament-1',
      };
    });
    prismaMock.match.findFirst.mockResolvedValue(null);
    prismaMock.availabilityPoll.findUnique.mockResolvedValue({
      votes: [{ userId: 'player-2', isAvailable: true }],
    });
    prismaMock.suspension.findMany.mockResolvedValue([
      {
        id: 'susp-2',
        userId: 'player-2',
        teamId: 'team-a',
        tournamentId: 'tournament-1',
        servingMatchId: 'match-2',
        carryForwardCount: 0,
        user: { firstName: 'Alex', lastName: 'Patel' },
      },
    ]);
    prismaMock.suspension.update.mockResolvedValue({});

    await service.resolveManualSuspensionsOnPlayingXiConfirm('match-2', 'team-a', [], []);

    expect(prismaMock.suspension.update).toHaveBeenCalledWith({
      where: { id: 'susp-2' },
      data: {
        status: SuspensionStatus.Pending,
        servingMatchId: null,
        actionedAtMatchId: 'match-2',
      },
    });
  });

  it('does not block confirm preflight when unchecked suspensions have no next match', async () => {
    prismaMock.match.findUnique.mockResolvedValue({
      id: 'match-2',
      tournamentId: 'tournament-1',
      startTime: new Date('2026-06-08T18:00:00Z'),
      matchDate: new Date('2026-06-08'),
      tournament: { ballType: BallType.Leather },
    });
    prismaMock.match.findFirst.mockResolvedValue(null);
    prismaMock.suspension.findMany.mockResolvedValue([
      {
        id: 'susp-2',
        userId: 'player-2',
        teamId: 'team-a',
        tournamentId: 'tournament-1',
        servingMatchId: 'match-2',
        user: { firstName: 'Alex', lastName: 'Patel' },
      },
    ]);
    prismaMock.availabilityPoll.findUnique.mockResolvedValue({
      votes: [{ userId: 'player-2', isAvailable: true }],
    });

    await expect(
      service.assertManualSuspensionSelection('match-2', 'team-a', [], ['player-xi']),
    ).resolves.toBeUndefined();
  });

  it('syncs pending suspensions from a live source match when Confirm Playing 11 opens', async () => {
    prismaMock.match.findUnique.mockResolvedValue({
      id: 'match-2',
      tournamentId: 'tournament-1',
      startTime: new Date('2026-06-08T18:00:00Z'),
      matchDate: new Date('2026-06-08'),
      tournament: { ballType: BallType.Leather },
    });
    prismaMock.match.findFirst.mockResolvedValue({
      id: 'match-1',
      attendancePunches: [
        { userId: 'player-1', teamId: 'team-a', status: AttendancePunchStatus.Late },
        { userId: 'player-2', teamId: 'team-a', status: AttendancePunchStatus.Late },
      ],
    });
    prismaMock.suspension.findFirst.mockResolvedValue(null);
    prismaMock.suspension.findMany.mockResolvedValue([]);
    prismaMock.suspension.create.mockResolvedValue({ id: 'susp-1' });
    prismaMock.suspension.updateMany.mockResolvedValue({ count: 0 });

    await service.syncPendingSuspensionsForServingMatch('match-2', 'team-a');

    expect(prismaMock.suspension.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          teamId: 'team-a',
          servingMatchId: null,
        }),
        data: { servingMatchId: 'match-2' },
      }),
    );
    expect(prismaMock.suspension.create).toHaveBeenCalledTimes(2);
    expect(prismaMock.suspension.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'player-1',
          triggeredByMatchId: 'match-1',
          servingMatchId: 'match-2',
          status: SuspensionStatus.Pending,
        }),
      }),
    );
  });

  it('does not sync when there is no prior live or completed source match', async () => {
    prismaMock.match.findUnique.mockResolvedValue({
      id: 'match-2',
      tournamentId: 'tournament-1',
      startTime: new Date('2026-06-08T18:00:00Z'),
      matchDate: new Date('2026-06-08'),
      tournament: { ballType: BallType.Leather },
    });
    prismaMock.match.findFirst.mockResolvedValue(null);

    await service.syncPendingSuspensionsForServingMatch('match-2', 'team-a');

    expect(prismaMock.suspension.create).not.toHaveBeenCalled();
  });

  it('does not duplicate when source match later completes after live sync (DP3)', async () => {
    prismaMock.match.findUnique.mockResolvedValue({
      ...completedMatch,
      attendancePunches: [
        { userId: 'player-1', teamId: 'team-a', status: AttendancePunchStatus.Late },
      ],
    });
    prismaMock.suspension.findMany.mockResolvedValue([]);
    prismaMock.suspension.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'susp-existing' });
    prismaMock.match.findFirst.mockResolvedValue({ id: 'match-2' });

    await service.generateForCompletedMatch('match-1');

    expect(prismaMock.suspension.create).not.toHaveBeenCalled();
  });
});
