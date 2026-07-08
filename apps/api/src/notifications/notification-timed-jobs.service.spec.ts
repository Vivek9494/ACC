import 'reflect-metadata';

import { NotificationTrigger } from './notifications.service';
import { NotificationTimedJobsService } from './notification-timed-jobs.service';

describe('NotificationTimedJobsService', () => {
  let prisma: {
    availabilityPoll: { findMany: jest.Mock };
    teamMembership: { findMany: jest.Mock };
    match: { findMany: jest.Mock };
    tournament: { findMany: jest.Mock };
    $queryRaw: jest.Mock;
  };
  let notifications: { sendToAudience: jest.Mock };
  let audience: {
    resolveTeamSquad: jest.Mock;
    resolveTournamentAudience: jest.Mock;
    resolveTournamentRegisteredPlayers: jest.Mock;
    resolveAllActiveUsers: jest.Mock;
  };
  let service: NotificationTimedJobsService;

  beforeEach(() => {
    prisma = {
      availabilityPoll: { findMany: jest.fn().mockResolvedValue([]) },
      teamMembership: { findMany: jest.fn().mockResolvedValue([]) },
      match: { findMany: jest.fn().mockResolvedValue([]) },
      tournament: { findMany: jest.fn().mockResolvedValue([]) },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    notifications = { sendToAudience: jest.fn().mockResolvedValue({ sent: true }) };
    audience = {
      resolveTeamSquad: jest.fn().mockResolvedValue([]),
      resolveTournamentAudience: jest.fn().mockResolvedValue([]),
      resolveTournamentRegisteredPlayers: jest.fn().mockResolvedValue([]),
      resolveAllActiveUsers: jest.fn().mockResolvedValue([]),
    };
    service = new NotificationTimedJobsService(
      prisma as never,
      notifications as never,
      audience as never,
    );
  });

  describe('sendPollReminders', () => {
    it('notifies non-voters on the team roster only', async () => {
      const now = new Date('2026-07-07T14:00:00.000Z');
      prisma.availabilityPoll.findMany.mockResolvedValue([
        {
          id: 'poll-1',
          matchId: 'm1',
          teamId: 'team-1',
          match: { tournamentId: 't1', tournament: { timezone: 'America/Toronto' } },
          votes: [{ userId: 'voted-1' }],
        },
      ]);
      prisma.teamMembership.findMany.mockResolvedValue([
        { userId: 'voted-1' },
        { userId: 'non-voter-1' },
        { userId: 'non-voter-2' },
      ]);

      await service.sendPollReminders(now);

      expect(notifications.sendToAudience).toHaveBeenCalledWith(
        ['non-voter-1', 'non-voter-2'],
        expect.objectContaining({
          triggerKey: NotificationTrigger.PollReminder,
          dedupeKey: `${NotificationTrigger.PollReminder}:poll-1:2026-07-07`,
          data: { matchId: 'm1', teamId: 'team-1', screen: 'poll' },
        }),
      );
    });

    it('skips when every roster member has voted', async () => {
      prisma.availabilityPoll.findMany.mockResolvedValue([
        {
          id: 'poll-1',
          matchId: 'm1',
          teamId: 'team-1',
          match: { tournamentId: 't1', tournament: { timezone: 'America/Toronto' } },
          votes: [{ userId: 'u1' }],
        },
      ]);
      prisma.teamMembership.findMany.mockResolvedValue([{ userId: 'u1' }]);

      await service.sendPollReminders();

      expect(notifications.sendToAudience).not.toHaveBeenCalled();
    });
  });

  describe('sendMatchReminders', () => {
    it('notifies both squads when the match is tomorrow in the venue zone', async () => {
      const now = new Date('2026-07-07T14:00:00.000Z');
      prisma.match.findMany.mockResolvedValue([
        {
          id: 'm1',
          matchDate: new Date('2026-07-08T04:00:00.000Z'),
          startTime: null,
          homeTeamId: 'home',
          awayTeamId: 'away',
          tournament: { timezone: 'America/Toronto' },
        },
      ]);
      audience.resolveTeamSquad.mockImplementation(async (teamId: string) =>
        teamId === 'home' ? ['h1'] : ['a1'],
      );

      await service.sendMatchReminders(now);

      expect(audience.resolveTeamSquad).toHaveBeenCalledWith('home');
      expect(audience.resolveTeamSquad).toHaveBeenCalledWith('away');
      expect(notifications.sendToAudience).toHaveBeenCalledWith(
        ['h1', 'a1'],
        expect.objectContaining({
          triggerKey: NotificationTrigger.MatchReminder,
          dedupeKey: `${NotificationTrigger.MatchReminder}:m1`,
        }),
      );
    });
  });

  describe('sendRegistrationOpened', () => {
    it('notifies the tournament audience when registration just opened', async () => {
      const now = new Date('2026-07-07T15:00:00.000Z');
      prisma.tournament.findMany.mockResolvedValue([{ id: 't1', name: 'APL 2026' }]);
      audience.resolveTournamentAudience.mockResolvedValue(['u1', 'u2']);

      await service.sendRegistrationOpened(now);

      expect(prisma.tournament.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            registrationOpenAt: {
              gt: new Date('2026-07-07T14:59:00.000Z'),
              lte: now,
            },
          }),
        }),
      );
      expect(notifications.sendToAudience).toHaveBeenCalledWith(
        ['u1', 'u2'],
        expect.objectContaining({
          triggerKey: NotificationTrigger.RegistrationOpened,
          dedupeKey: `${NotificationTrigger.RegistrationOpened}:t1`,
        }),
      );
    });
  });

  describe('sendRegistrationClosing', () => {
    it('notifies the tournament audience ~10 minutes before close', async () => {
      const now = new Date('2026-07-07T14:50:00.000Z');
      prisma.tournament.findMany.mockResolvedValue([{ id: 't1', name: 'APL 2026' }]);
      audience.resolveTournamentAudience.mockResolvedValue(['u1']);

      await service.sendRegistrationClosing(now);

      expect(prisma.tournament.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            registrationCloseAt: {
              gt: new Date('2026-07-07T15:00:00.000Z'),
              lte: new Date('2026-07-07T15:01:00.000Z'),
            },
          }),
        }),
      );
      expect(notifications.sendToAudience).toHaveBeenCalledWith(
        ['u1'],
        expect.objectContaining({
          triggerKey: NotificationTrigger.RegistrationClosing,
          dedupeKey: `${NotificationTrigger.RegistrationClosing}:t1`,
        }),
      );
    });
  });

  describe('sendVideoUploadClosing', () => {
    it('notifies registered players when the upload deadline is ~10 minutes away', async () => {
      const now = new Date('2026-07-07T14:50:00.000Z');
      prisma.tournament.findMany.mockResolvedValue([{ id: 't1', name: 'APL 2026' }]);
      audience.resolveTournamentRegisteredPlayers.mockResolvedValue(['p1', 'p2']);

      await service.sendVideoUploadClosing(now);

      expect(audience.resolveTournamentRegisteredPlayers).toHaveBeenCalledWith('t1');
      expect(notifications.sendToAudience).toHaveBeenCalledWith(
        ['p1', 'p2'],
        expect.objectContaining({
          triggerKey: NotificationTrigger.VideoUploadClosing,
          dedupeKey: `${NotificationTrigger.VideoUploadClosing}:t1`,
        }),
      );
    });
  });

  describe('sendBirthdayNotifications', () => {
    it('notifies all active users once per birthday person per year', async () => {
      const now = new Date('2026-07-07T14:00:00.000Z');
      prisma.$queryRaw.mockResolvedValue([
        { id: 'bday-1', firstName: 'Alex', lastName: 'Singh' },
      ]);
      audience.resolveAllActiveUsers.mockResolvedValue(['u1', 'u2', 'bday-1']);

      await service.sendBirthdayNotifications(now);

      expect(notifications.sendToAudience).toHaveBeenCalledWith(
        ['u1', 'u2', 'bday-1'],
        expect.objectContaining({
          triggerKey: NotificationTrigger.Birthday,
          dedupeKey: `${NotificationTrigger.Birthday}:bday-1:2026`,
          body: 'Wish Alex Singh a happy birthday today!',
        }),
      );
    });
  });
});
