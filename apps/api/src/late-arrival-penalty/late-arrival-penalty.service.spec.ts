import 'reflect-metadata';

import {
  type AuthUser,
  AttendancePunchStatus,
  BallType,
  LateArrivalFailedServeReason,
  LateArrivalPenaltyState,
  UserRole,
} from '@acc/types';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { PermissionService } from '../authz/permission.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { LateArrivalPenaltyService } from './late-arrival-penalty.service';

const captain: AuthUser = {
  id: 'captain-1',
  firstName: 'Team',
  lastName: 'Captain',
  mobileNumber: '+15555550003',
  email: 'captain@acc.local',
  centerId: 'center-A',
  jerseyNumber: 1,
  profilePhotoUrl: null,
  role: UserRole.Player,
  isActive: true,
};

const leatherMatch = {
  id: 'match-a',
  tournamentId: 'tour-1',
  homeTeamId: 'team-1',
  awayTeamId: 'team-2',
  matchDate: new Date('2026-06-10T00:00:00Z'),
  startTime: new Date('2026-06-10T14:00:00Z'),
  reportingTime: new Date('2026-06-10T13:00:00Z'),
  tournament: { ballType: BallType.Leather },
};

describe('LateArrivalPenaltyService', () => {
  let service: LateArrivalPenaltyService;
  let prisma: {
    lateArrivalPenalty: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    lateArrivalPenaltyTransition: { create: jest.Mock };
    match: { findFirst: jest.Mock; findUnique: jest.Mock };
    team: { findUnique: jest.Mock };
    roleAssignment: { findFirst: jest.Mock };
    matchSquadPlayer: { findFirst: jest.Mock };
    matchAttendancePunch: { findUnique: jest.Mock };
  };
  let permissions: { check: jest.Mock };
  let audit: { record: jest.Mock };
  let notifications: { sendNotification: jest.Mock };

  beforeEach(() => {
    prisma = {
      lateArrivalPenalty: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'penalty-1',
            ...data,
            assignedServeMatchId: data.assignedServeMatchId ?? null,
            dischargedAt: null,
            cancelledAt: null,
            cancelledByUserId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
        update: jest.fn().mockImplementation(({ where, data }) =>
          Promise.resolve({
            id: where.id,
            playerId: 'player-1',
            teamId: 'team-1',
            tournamentId: 'tour-1',
            originMatchId: 'match-a',
            state: data.state,
            assignedServeMatchId:
              data.assignedServeMatch?.connect?.id ??
              (data.assignedServeMatch?.disconnect ? null : 'match-c'),
            dischargedAt: data.dischargedAt ?? null,
            cancelledAt: data.cancelledAt ?? null,
            cancelledByUserId: data.cancelledBy?.connect?.id ?? null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
      },
      lateArrivalPenaltyTransition: { create: jest.fn().mockResolvedValue({}) },
      match: {
        findFirst: jest.fn().mockResolvedValue(leatherMatch),
        findUnique: jest.fn().mockResolvedValue({ tournamentId: 'tour-1' }),
      },
      team: { findUnique: jest.fn().mockResolvedValue({ id: 'team-1', tournamentId: 'tour-1' }) },
      roleAssignment: { findFirst: jest.fn().mockResolvedValue({ id: 'ra-1' }) },
      matchSquadPlayer: { findFirst: jest.fn().mockResolvedValue(null) },
      matchAttendancePunch: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    permissions = { check: jest.fn().mockResolvedValue(true) };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    notifications = { sendNotification: jest.fn().mockResolvedValue(undefined) };
    service = new LateArrivalPenaltyService(
      prisma as unknown as PrismaService,
      permissions as unknown as PermissionService,
      audit as unknown as AuditService,
      notifications as unknown as NotificationsService,
    );
  });

  it('creates OWED when captain verifies late and player owes nothing', async () => {
    await service.onCaptainVerifyLate(captain, 'match-a', 'team-1', 'player-1');

    expect(prisma.lateArrivalPenalty.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          playerId: 'player-1',
          state: LateArrivalPenaltyState.Owed,
          originMatchId: 'match-a',
        }),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'LATE_ARRIVAL_PENALTY_CREATED' }),
    );
  });

  it('does not create a second penalty when player already owes one', async () => {
    prisma.lateArrivalPenalty.findFirst.mockResolvedValue({
      id: 'penalty-existing',
      playerId: 'player-1',
      teamId: 'team-1',
      state: LateArrivalPenaltyState.Owed,
      originMatchId: 'match-x',
      assignedServeMatchId: null,
    });

    await service.onCaptainVerifyLate(captain, 'match-b', 'team-1', 'player-1');

    expect(prisma.lateArrivalPenalty.create).not.toHaveBeenCalled();
  });

  it('designates OWED penalty to serve at a future match', async () => {
    prisma.lateArrivalPenalty.findFirst
      .mockResolvedValueOnce({
        id: 'penalty-1',
        playerId: 'player-1',
        teamId: 'team-1',
        tournamentId: 'tour-1',
        originMatchId: 'match-a',
        state: LateArrivalPenaltyState.Owed,
        assignedServeMatchId: null,
      })
      .mockResolvedValue(null);

    const result = await service.designateToServe(captain, 'team-1', 'penalty-1', {
      serveMatchId: 'match-c',
    });

    expect(result.state).toBe(LateArrivalPenaltyState.Assigned);
    expect(result.assignedServeMatchId).toBe('match-c');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'LATE_ARRIVAL_PENALTY_DESIGNATED' }),
    );
    expect(notifications.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userIds: ['player-1'],
        triggerKey: 'PENALTY_SERVE_DESIGNATED',
        dedupeKey: 'PENALTY_SERVE_DESIGNATED:match-c:player-1',
        data: { matchId: 'match-c', screen: 'match' },
      }),
    );
  });

  it('discharges penalty when captain verifies on-time serve completion', async () => {
    prisma.lateArrivalPenalty.findFirst.mockResolvedValue({
      id: 'penalty-1',
      playerId: 'player-1',
      teamId: 'team-1',
      tournamentId: 'tour-1',
      originMatchId: 'match-a',
      state: LateArrivalPenaltyState.Assigned,
      assignedServeMatchId: 'match-c',
    });
    prisma.matchAttendancePunch.findUnique.mockResolvedValue({
      status: AttendancePunchStatus.OnTime,
      teamId: 'team-1',
    });

    await service.onCaptainVerifyServeCompletion(captain, 'match-c', 'team-1', 'player-1');

    expect(prisma.lateArrivalPenalty.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ state: LateArrivalPenaltyState.Discharged }),
      }),
    );
  });

  it('carries forward when designated server is verified late at serve match', async () => {
    prisma.lateArrivalPenalty.findFirst.mockResolvedValue({
      id: 'penalty-1',
      playerId: 'player-1',
      teamId: 'team-1',
      tournamentId: 'tour-1',
      originMatchId: 'match-a',
      state: LateArrivalPenaltyState.Assigned,
      assignedServeMatchId: 'match-c',
    });

    await service.onCaptainVerifyLate(captain, 'match-c', 'team-1', 'player-1');

    expect(prisma.lateArrivalPenalty.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          state: LateArrivalPenaltyState.Owed,
          assignedServeMatch: { disconnect: true },
        }),
      }),
    );
    expect(prisma.lateArrivalPenaltyTransition.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reason: 'Failed serve: late arrival at serving match',
        }),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'LATE_ARRIVAL_PENALTY_CARRIED_FORWARD',
        details: expect.objectContaining({
          failureKind: LateArrivalFailedServeReason.Late,
        }),
      }),
    );
    expect(prisma.lateArrivalPenalty.create).not.toHaveBeenCalled();
  });

  it('cancels an active penalty', async () => {
    prisma.lateArrivalPenalty.findFirst.mockResolvedValue({
      id: 'penalty-1',
      playerId: 'player-1',
      teamId: 'team-1',
      tournamentId: 'tour-1',
      originMatchId: 'match-a',
      state: LateArrivalPenaltyState.Owed,
      assignedServeMatchId: null,
    });

    const result = await service.cancelPenalty(captain, 'team-1', 'penalty-1', {
      reason: 'Promoted into Playing 11',
    });

    expect(result.state).toBe(LateArrivalPenaltyState.Cancelled);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'LATE_ARRIVAL_PENALTY_CANCELLED' }),
    );
  });

  it('rejects designate when player is in the serve match squad', async () => {
    prisma.lateArrivalPenalty.findFirst.mockResolvedValue({
      id: 'penalty-1',
      playerId: 'player-1',
      teamId: 'team-1',
      tournamentId: 'tour-1',
      originMatchId: 'match-a',
      state: LateArrivalPenaltyState.Owed,
      assignedServeMatchId: null,
    });
    prisma.matchSquadPlayer.findFirst.mockResolvedValue({ id: 'squad-player-1' });

    await expect(
      service.designateToServe(captain, 'team-1', 'penalty-1', { serveMatchId: 'match-c' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('carries forward designated server no-show after capture window', async () => {
    prisma.lateArrivalPenalty.findMany.mockResolvedValue([
      {
        id: 'penalty-1',
        playerId: 'player-1',
        teamId: 'team-1',
        state: LateArrivalPenaltyState.Assigned,
        assignedServeMatchId: 'match-c',
      },
    ]);
    prisma.match.findFirst.mockResolvedValue({
      ...leatherMatch,
      id: 'match-c',
      reportingTime: new Date(Date.now() - 5 * 3_600_000),
      startTime: new Date(Date.now() - 2 * 3_600_000),
    });

    await service.evaluateNoShowServes('match-c', 'team-1', new Date());

    expect(prisma.lateArrivalPenalty.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ state: LateArrivalPenaltyState.Owed }),
      }),
    );
    expect(prisma.lateArrivalPenaltyTransition.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reason: 'Failed serve: no-show at serving match',
        }),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'LATE_ARRIVAL_PENALTY_CARRIED_FORWARD',
        details: expect.objectContaining({
          failureKind: LateArrivalFailedServeReason.NoShow,
        }),
      }),
    );
  });

  it('rejects non-captain from listing outstanding penalties', async () => {
    prisma.roleAssignment.findFirst.mockResolvedValue(null);

    await expect(service.listOutstandingForTeam(captain, 'team-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
