import 'reflect-metadata';

import {
  type AuthUser,
  BallType,
  MatchState,
  UserRole,
} from '@acc/types';

import { ParticipationPollService } from './participation-poll.service';

function xi(prefix: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => `${prefix}-${i + 1}`);
}

const playerActor: AuthUser = {
  id: 'player-1',
  firstName: 'Pat',
  lastName: 'Player',
  mobileNumber: '+15555551001',
  email: 'pat@acc.local',
  centerId: 'center-A',
  jerseyNumber: 12,
  profilePhotoUrl: null,
  role: UserRole.Player,
  isActive: true,
};

const clubManager: AuthUser = {
  ...playerActor,
  id: 'cm-1',
  role: UserRole.ClubManager,
};

function buildPollService(): {
  service: ParticipationPollService;
  prisma: {
    availabilityPoll: { findUnique: jest.Mock };
    teamMembership: { findMany: jest.Mock };
    registration: { findMany: jest.Mock };
    matchScorerGrant: { findFirst: jest.Mock };
  };
  matches: { lockPlayingXiFromPoll: jest.Mock };
  permissions: { check: jest.Mock };
  penalties: { syncServeDesignations: jest.Mock };
  suspensions: {
    assertManualSuspensionSelection: jest.Mock;
    resolveManualSuspensionsOnPlayingXiConfirm: jest.Mock;
  };
} {
  const prisma = {
    availabilityPoll: { findUnique: jest.fn() },
    teamMembership: { findMany: jest.fn() },
    registration: { findMany: jest.fn() },
    matchScorerGrant: { findFirst: jest.fn().mockResolvedValue(null) },
    roleAssignment: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  const matches = { lockPlayingXiFromPoll: jest.fn().mockResolvedValue(undefined) };
  const permissions = { check: jest.fn().mockResolvedValue(false) };
  const penalties = { syncServeDesignations: jest.fn().mockResolvedValue(undefined) };
  const suspensions = {
    syncPendingForMatchTeam: jest.fn(),
    assertManualSuspensionSelection: jest.fn().mockResolvedValue(undefined),
    resolveManualSuspensionsOnPlayingXiConfirm: jest.fn().mockResolvedValue(undefined),
  };

  const service = new ParticipationPollService(
    prisma as never,
    permissions as never,
    matches as never,
    penalties as never,
    suspensions as never,
    { record: jest.fn() } as never,
  );

  return { service, prisma, matches, permissions, penalties, suspensions };
}

function pollFixture(playingXi: string[]) {
  const roster = playingXi.map((userId, index) => ({
    userId,
    user: {
      id: userId,
      firstName: `P${index + 1}`,
      lastName: 'Test',
      profilePhotoUrl: null,
    },
  }));

  return {
    id: 'poll-1',
    teamId: 'team-H',
    matchId: 'match-1',
    match: {
      id: 'match-1',
      tournamentId: 'tour-1',
      matchDate: new Date('2026-06-14T00:00:00.000Z'),
      startTime: null,
      state: MatchState.Scheduled,
      homeTeamId: 'team-H',
      awayTeamId: 'team-A',
      homeTeam: { id: 'team-H', name: 'Home' },
      awayTeam: { id: 'team-A', name: 'Away' },
      tournament: {
        id: 'tour-1',
        name: 'ACC',
        ballType: BallType.Leather,
        timezone: 'America/Toronto',
      },
    },
    team: { name: 'Home' },
    votes: playingXi.map((userId) => ({
      userId,
      isAvailable: true,
      votedAt: new Date('2026-06-10T12:00:00.000Z'),
      user: {
        id: userId,
        firstName: 'P',
        lastName: 'Test',
        profilePhotoUrl: null,
      },
    })),
    roster,
  };
}

describe('ParticipationPollService — Confirm Playing 11 auth', () => {
  it('allows Club Manager to confirm via poll', async () => {
    const playingXi = xi('p', 11);
    const fixture = pollFixture(playingXi);
    const { service, prisma, matches } = buildPollService();

    prisma.availabilityPoll.findUnique.mockResolvedValue(fixture);
    prisma.teamMembership.findMany.mockResolvedValue(fixture.roster);
    prisma.registration.findMany.mockResolvedValue([]);

    jest.spyOn(service, 'getPlayingXiSelection').mockResolvedValue({} as never);

    await service.confirmPlayingXi(clubManager, 'poll-1', {
      playingXi,
      substitutes: [],
      penaltyServerUserIds: [],
    });

    expect(matches.lockPlayingXiFromPoll).toHaveBeenCalledWith(
      clubManager,
      'match-1',
      'team-H',
      playingXi,
      [],
      expect.any(Set),
      [],
    );
  });

  it('rejects a regular player who is not captain/VC', async () => {
    const playingXi = xi('p', 11);
    const fixture = pollFixture(playingXi);
    const { service, prisma, permissions } = buildPollService();

    prisma.availabilityPoll.findUnique.mockResolvedValue(fixture);
    permissions.check.mockResolvedValue(false);

    await expect(
      service.confirmPlayingXi(playerActor, 'poll-1', {
        playingXi,
        substitutes: [],
        penaltyServerUserIds: [],
      }),
    ).rejects.toMatchObject({ response: { error: 'FORBIDDEN' } });
  });
});
