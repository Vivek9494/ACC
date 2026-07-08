import 'reflect-metadata';

import { BallType, UserRole } from '@acc/types';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { LeatherTournamentVisibilityService } from './leather-tournament-visibility.service';

describe('LeatherTournamentVisibilityService', () => {
  let prisma: {
    matchSquadPlayer: { findFirst: jest.Mock; findMany: jest.Mock };
    teamMembership: { findFirst: jest.Mock; findMany: jest.Mock };
    tournamentLeatherInvite: { findMany: jest.Mock; findUnique: jest.Mock; createMany: jest.Mock; deleteMany: jest.Mock };
    tournament: { findMany: jest.Mock; findUnique: jest.Mock };
    user: { findMany: jest.Mock };
    registration: { findUnique: jest.Mock; findMany: jest.Mock };
  };
  let service: LeatherTournamentVisibilityService;

  const futureStart = new Date('2099-06-01T00:00:00.000Z');

  beforeEach(() => {
    prisma = {
      matchSquadPlayer: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      teamMembership: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      tournamentLeatherInvite: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      tournament: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({
          id: 'tour-1',
          startAt: futureStart,
          ballType: BallType.Leather,
          isDeleted: false,
        }),
      },
      user: { findMany: jest.fn().mockResolvedValue([]) },
      registration: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new LeatherTournamentVisibilityService(prisma as unknown as PrismaService);
  });

  it('treats any locked-XI in a leather tournament as existing', async () => {
    prisma.matchSquadPlayer.findFirst.mockResolvedValue({ id: 'squad-1' });
    prisma.teamMembership.findFirst.mockResolvedValue(null);

    await expect(service.isExistingLeatherPlayer('player-1')).resolves.toBe(true);
    expect(prisma.matchSquadPlayer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'player-1',
          squad: expect.objectContaining({
            match: expect.objectContaining({
              isDeleted: false,
              tournament: expect.objectContaining({
                ballType: BallType.Leather,
                isDeleted: false,
              }),
            }),
          }),
        }),
      }),
    );
  });

  it('treats active leather roster as existing', async () => {
    prisma.matchSquadPlayer.findFirst.mockResolvedValue(null);
    prisma.teamMembership.findFirst.mockResolvedValue({ id: 'member-1' });

    await expect(service.isExistingLeatherPlayer('player-1')).resolves.toBe(true);
  });

  it('allows Club Manager to register without invite or existing leather history', async () => {
    await expect(
      service.canRegisterForLeatherTournament('cm-1', 'tour-1', {
        id: 'cm-1',
        role: UserRole.ClubManager,
      } as never),
    ).resolves.toBe(true);
    expect(prisma.teamMembership.findFirst).not.toHaveBeenCalled();
    expect(prisma.tournamentLeatherInvite.findUnique).not.toHaveBeenCalled();
  });

  it('rejects non-Club-Manager invite creation', async () => {
    await expect(
      service.createInvites(
        {
          id: 'admin-1',
          role: UserRole.Admin,
        } as never,
        'tour-1',
        ['player-2'],
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lists invite candidates as inverse of existing leather players', async () => {
    prisma.matchSquadPlayer.findMany.mockResolvedValue([{ userId: 'existing-1' }]);
    prisma.teamMembership.findMany.mockResolvedValue([{ userId: 'existing-2' }]);
    prisma.tournamentLeatherInvite.findMany.mockResolvedValue([{ userId: 'invited-1' }]);
    prisma.registration.findMany.mockResolvedValue([{ userId: 'registered-1' }]);
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'eligible-1',
        firstName: 'New',
        lastName: 'Player',
        centerId: 'center-1',
        center: { name: 'Barrie' },
      },
    ]);

    const candidates = await service.listInviteCandidates('tour-1', undefined);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.userId).toBe('eligible-1');
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: {
            notIn: expect.arrayContaining(['existing-1', 'existing-2', 'invited-1', 'registered-1']),
          },
        }),
      }),
    );
  });

  it('rejects inviting a player already registered for this tournament', async () => {
    prisma.registration.findMany.mockResolvedValue([{ userId: 'player-2' }]);

    await expect(
      service.createInvites(
        {
          id: 'cm-1',
          role: UserRole.ClubManager,
        } as never,
        'tour-1',
        ['player-2'],
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
