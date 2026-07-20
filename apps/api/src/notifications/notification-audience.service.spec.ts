import 'reflect-metadata';

import { NotFoundException } from '@nestjs/common';

import { NotificationAudienceService } from './notification-audience.service';

describe('NotificationAudienceService', () => {
  let prisma: {
    tournament: { findFirst: jest.Mock };
    tournamentCenter: { findMany: jest.Mock };
    user: { findMany: jest.Mock };
    matchSquadPlayer: { findMany: jest.Mock };
    registration: { findMany: jest.Mock };
    team: { findFirst: jest.Mock };
    teamMembership: { findMany: jest.Mock };
    matchSquad: { findUnique: jest.Mock };
  };
  let service: NotificationAudienceService;

  beforeEach(() => {
    prisma = {
      tournament: { findFirst: jest.fn() },
      tournamentCenter: { findMany: jest.fn() },
      user: { findMany: jest.fn() },
      matchSquadPlayer: { findMany: jest.fn() },
      team: { findFirst: jest.fn() },
      teamMembership: { findMany: jest.fn() },
      matchSquad: { findUnique: jest.fn() },
      registration: { findMany: jest.fn() },
    };
    service = new NotificationAudienceService(prisma as never);
  });

  describe('resolveTournamentAudience', () => {
    it('APL/CENTER: returns users of the tournament’s selected centers', async () => {
      prisma.tournament.findFirst.mockResolvedValue({ id: 't1', ballType: 'TENNIS' });
      prisma.tournamentCenter.findMany.mockResolvedValue([
        { centerId: 'c1' },
        { centerId: 'c2' },
      ]);
      prisma.user.findMany.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]);

      const result = await service.resolveTournamentAudience('t1');

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null, isActive: true, centerId: { in: ['c1', 'c2'] } },
        select: { id: true },
      });
      expect(result).toEqual(['u1', 'u2']);
    });

    it('MULTI-CENTER: notifies only participating centers (e.g. North York + Etobicoke), not all centers', async () => {
      const northYork = 'center-north-york';
      const etobicoke = 'center-etobicoke';
      const brampton = 'center-brampton';

      prisma.tournament.findFirst.mockResolvedValue({ id: 'ny-etob-multi', ballType: 'TENNIS' });
      prisma.tournamentCenter.findMany.mockResolvedValue([
        { centerId: northYork },
        { centerId: etobicoke },
      ]);
      prisma.user.findMany.mockResolvedValue([{ id: 'ny-user' }, { id: 'etob-user' }]);

      const result = await service.resolveTournamentAudience('ny-etob-multi');

      expect(prisma.tournamentCenter.findMany).toHaveBeenCalledWith({
        where: { tournamentId: 'ny-etob-multi' },
        select: { centerId: true },
      });
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          isActive: true,
          centerId: { in: [northYork, etobicoke] },
        },
        select: { id: true },
      });
      const centerFilter = prisma.user.findMany.mock.calls[0][0].where.centerId.in as string[];
      expect(centerFilter).not.toContain(brampton);
      expect(result).toEqual(['ny-user', 'etob-user']);
      expect(result).not.toContain('brampton-user');
    });

    it('APL/CENTER: returns empty when no centers are linked', async () => {
      prisma.tournament.findFirst.mockResolvedValue({ id: 't1', ballType: 'TENNIS' });
      prisma.tournamentCenter.findMany.mockResolvedValue([]);

      const result = await service.resolveTournamentAudience('t1');

      expect(result).toEqual([]);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it('ACC/Leather: returns users who played (XI or SUBSTITUTE) a leather match', async () => {
      prisma.tournament.findFirst.mockResolvedValue({ id: 't1', ballType: 'LEATHER' });
      prisma.matchSquadPlayer.findMany.mockResolvedValue([
        { userId: 'p1' },
        { userId: 'p2' },
      ]);

      const result = await service.resolveTournamentAudience('t1');

      const call = prisma.matchSquadPlayer.findMany.mock.calls[0][0];
      expect(call.where.role).toEqual({ in: ['PLAYING_XI', 'SUBSTITUTE'] });
      expect(call.where.squad.match.tournament.ballType).toBe('LEATHER');
      expect(call.distinct).toEqual(['userId']);
      expect(result).toEqual(['p1', 'p2']);
    });

    it('throws when the tournament is missing', async () => {
      prisma.tournament.findFirst.mockResolvedValue(null);
      await expect(service.resolveTournamentAudience('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('resolveAllActiveUsers', () => {
    it('returns every active, non-deleted user id (deduped)', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }, { id: 'u1' }]);

      const result = await service.resolveAllActiveUsers();

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null, isActive: true },
        select: { id: true },
      });
      expect(result).toEqual(['u1', 'u2']);
    });
  });

  describe('resolveTeamSquad', () => {
    it('returns the team roster user ids', async () => {
      prisma.team.findFirst.mockResolvedValue({ id: 'team-1', tournamentId: 't1' });
      prisma.teamMembership.findMany.mockResolvedValue([{ userId: 'a' }, { userId: 'b' }]);

      const result = await service.resolveTeamSquad('team-1');

      expect(result).toEqual(['a', 'b']);
    });

    it('throws when the team is missing', async () => {
      prisma.team.findFirst.mockResolvedValue(null);
      await expect(service.resolveTeamSquad('nope')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('resolveTeamPlaying11', () => {
    it('returns XI + substitutes for the match squad', async () => {
      prisma.matchSquad.findUnique.mockResolvedValue({
        players: [{ userId: 'x1' }, { userId: 'x2' }],
      });

      const result = await service.resolveTeamPlaying11('m1', 'team-1');

      const call = prisma.matchSquad.findUnique.mock.calls[0][0];
      expect(call.where).toEqual({ matchId_teamId: { matchId: 'm1', teamId: 'team-1' } });
      expect(call.select.players.where.role).toEqual({ in: ['PLAYING_XI', 'SUBSTITUTE'] });
      expect(result).toEqual(['x1', 'x2']);
    });

    it('returns empty when no squad exists yet', async () => {
      prisma.matchSquad.findUnique.mockResolvedValue(null);
      const result = await service.resolveTeamPlaying11('m1', 'team-1');
      expect(result).toEqual([]);
    });
  });

  describe('resolveTournamentRegisteredPlayers', () => {
    it('returns confirmed and waitlisted registrants (deduped)', async () => {
      prisma.registration.findMany.mockResolvedValue([
        { userId: 'u1' },
        { userId: 'u2' },
        { userId: 'u1' },
      ]);

      const result = await service.resolveTournamentRegisteredPlayers('t1');

      expect(prisma.registration.findMany).toHaveBeenCalledWith({
        where: {
          tournamentId: 't1',
          status: { in: ['CONFIRMED', 'IN_WAITLIST'] },
          user: { is: { deletedAt: null, isActive: true } },
        },
        select: { userId: true },
      });
      expect(result).toEqual(['u1', 'u2']);
    });
  });
});
