import 'reflect-metadata';

import { type AuthUser, MatchState, Permission, TournamentType } from '@acc/types';
import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { LockPlayingXiDto } from './dto/lock-playing-xi.dto';
import { MatchesService } from './matches.service';

type AnyMock = jest.Mock;

interface PrismaMock {
  tournament: { findUnique: AnyMock };
  match: { findUnique: AnyMock; create: AnyMock; update: AnyMock; findMany: AnyMock };
  team: { count: AnyMock };
  teamMembership: { findMany: AnyMock };
  registration: { findMany: AnyMock };
  suspension: { findMany: AnyMock };
  user: { findMany: AnyMock };
  matchSquad: { findUnique: AnyMock; create: AnyMock; update: AnyMock; count: AnyMock };
  matchSquadPlayer: { deleteMany: AnyMock; createMany: AnyMock };
  $transaction: AnyMock;
}

const actor: AuthUser = {
  id: 'captain-1',
  firstName: 'Cap',
  lastName: 'Tain',
  mobileNumber: '+15555551000',
  email: 'cap@acc.local',
  centerId: 'center-A',
  jerseyNumber: 7,
  profilePhotoUrl: null,
  role: 'PLAYER' as AuthUser['role'],
  isActive: true,
};

function xi(prefix: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => `${prefix}-${i + 1}`);
}

function buildService(): {
  service: MatchesService;
  prisma: PrismaMock;
  permissions: { check: AnyMock };
  scorerGrants: Record<string, AnyMock>;
  notifications: { notify: AnyMock };
} {
  const prisma: PrismaMock = {
    tournament: { findUnique: jest.fn() },
    match: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    team: { count: jest.fn().mockResolvedValue(2) },
    teamMembership: { findMany: jest.fn().mockResolvedValue([]) },
    registration: { findMany: jest.fn().mockResolvedValue([]) },
    suspension: { findMany: jest.fn().mockResolvedValue([]) },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    matchSquad: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
    matchSquadPlayer: { deleteMany: jest.fn(), createMany: jest.fn() },
    $transaction: jest.fn(),
  };

  prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(prisma));

  const permissions = { check: jest.fn().mockResolvedValue(true) };
  const scorerGrants = {
    grant: jest.fn().mockResolvedValue(undefined),
    revoke: jest.fn().mockResolvedValue(undefined),
    revokeAllForMatch: jest.fn().mockResolvedValue(undefined),
    hasActiveGrant: jest.fn().mockResolvedValue(false),
  };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };

  const service = new MatchesService(
    prisma as never,
    permissions as never,
    scorerGrants as never,
    notifications as never,
    audit as never,
  );
  return { service, prisma, permissions, scorerGrants, notifications };
}

function matchRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'match-1',
    tournamentId: 'tour-1',
    matchCode: 'M1',
    state: MatchState.Scheduled,
    homeTeamId: 'team-H',
    awayTeamId: null,
    externalOpponentName: 'Visitors XI',
    matchDate: null,
    startTime: null,
    reportingTime: null,
    groundLocation: null,
    youtubeUrl: null,
    tossWinner: null,
    tossDecision: null,
    homeTeam: { name: 'Home' },
    awayTeam: null,
    tournament: { impactPlayerEnabled: false, type: TournamentType.ACC },
    squads: [],
    scorerGrants: [],
    ...overrides,
  };
}

describe('MatchesService — state machine (§5.2)', () => {
  it('rejects an illegal transition', async () => {
    const { service, prisma } = buildService();
    prisma.match.findUnique.mockResolvedValue(matchRow({ state: MatchState.Scheduled }));
    await expect(service.transition(actor, 'match-1', MatchState.Live)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('allows a legal transition and auto-revokes scorer grants at match end', async () => {
    const { service, prisma, scorerGrants } = buildService();
    prisma.match.findUnique.mockResolvedValue(matchRow({ state: MatchState.Live }));
    prisma.match.update.mockResolvedValue({});

    await service.transition(actor, 'match-1', MatchState.Completed);

    // §13.1: completion also stamps `completedAt` to start the confirm window.
    expect(prisma.match.update).toHaveBeenCalledWith({
      where: { id: 'match-1' },
      data: { state: MatchState.Completed, completedAt: expect.any(Date) },
    });
    expect(scorerGrants.revokeAllForMatch).toHaveBeenCalledWith('match-1');
  });

  it('does not revoke grants on a non-terminal transition (Live → Rain Interrupted)', async () => {
    const { service, prisma, scorerGrants } = buildService();
    prisma.match.findUnique.mockResolvedValue(matchRow({ state: MatchState.Live }));
    prisma.match.update.mockResolvedValue({});

    await service.transition(actor, 'match-1', MatchState.RainInterrupted);
    expect(scorerGrants.revokeAllForMatch).not.toHaveBeenCalled();
  });

  it('rejects reaching Playing 11 Locked via the generic status endpoint', async () => {
    const { service, prisma } = buildService();
    prisma.match.findUnique.mockResolvedValue(matchRow({ state: MatchState.Scheduled }));
    await expect(
      service.transition(actor, 'match-1', MatchState.PlayingXiLocked),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('MatchesService — Playing 11 lock (§9.7, §8)', () => {
  it('locks the XI and moves an ACC match to Playing 11 Locked', async () => {
    const { service, prisma, notifications } = buildService();
    prisma.match.findUnique.mockResolvedValue(matchRow({ state: MatchState.Scheduled }));
    const playingXi = xi('p', 11);
    prisma.teamMembership.findMany.mockResolvedValue(playingXi.map((userId) => ({ userId })));
    prisma.matchSquad.findUnique.mockResolvedValue(null);
    prisma.matchSquad.create.mockResolvedValue({ id: 'squad-1' });
    prisma.matchSquad.count.mockResolvedValue(1);
    prisma.match.update.mockResolvedValue({});

    await service.lockPlayingXi(actor, 'match-1', {
      teamId: 'team-H',
      playingXi,
      substitutes: [],
    });

    expect(prisma.match.update).toHaveBeenCalledWith({
      where: { id: 'match-1' },
      data: { state: MatchState.PlayingXiLocked },
    });
    expect(notifications.notify).toHaveBeenCalled();
  });

  it('rejects a suspended player named as a substitute (§9.7)', async () => {
    const { service, prisma } = buildService();
    prisma.match.findUnique.mockResolvedValue(matchRow({ state: MatchState.Scheduled }));
    const playingXi = xi('p', 11);
    const substitutes = ['sub-1'];
    prisma.teamMembership.findMany.mockResolvedValue(
      [...playingXi, ...substitutes].map((userId) => ({ userId })),
    );
    prisma.suspension.findMany.mockResolvedValue([{ userId: 'sub-1' }]);

    await expect(
      service.lockPlayingXi(actor, 'match-1', { teamId: 'team-H', playingXi, substitutes }),
    ).rejects.toMatchObject({ response: { error: 'SUSPENDED_SUBSTITUTE' } });
  });

  it('rejects impact candidates when Impact Player is not enabled', async () => {
    const { service, prisma } = buildService();
    prisma.match.findUnique.mockResolvedValue(
      matchRow({ state: MatchState.Scheduled, tournament: { impactPlayerEnabled: false, type: 'ACC' } }),
    );
    await expect(
      service.lockPlayingXi(actor, 'match-1', {
        teamId: 'team-H',
        playingXi: xi('p', 11),
        substitutes: [],
        impactCandidates: ['imp-1'],
      }),
    ).rejects.toMatchObject({ response: { error: 'IMPACT_NOT_ENABLED' } });
  });

  it('rejects an active Impact Player not among the candidates', async () => {
    const { service, prisma } = buildService();
    prisma.match.findUnique.mockResolvedValue(
      matchRow({ state: MatchState.Scheduled, tournament: { impactPlayerEnabled: true, type: 'APL' } }),
    );
    await expect(
      service.lockPlayingXi(actor, 'match-1', {
        teamId: 'team-H',
        playingXi: xi('p', 11),
        substitutes: [],
        impactCandidates: ['imp-1', 'imp-2'],
        activeImpactUserId: 'imp-9',
      }),
    ).rejects.toMatchObject({ response: { error: 'INVALID_ACTIVE_IMPACT' } });
  });

  it('rejects locking when the match has already started', async () => {
    const { service, prisma } = buildService();
    prisma.match.findUnique.mockResolvedValue(matchRow({ state: MatchState.Live }));
    await expect(
      service.lockPlayingXi(actor, 'match-1', { teamId: 'team-H', playingXi: xi('p', 11), substitutes: [] }),
    ).rejects.toMatchObject({ response: { error: 'INVALID_MATCH_STATE' } });
  });
});

describe('MatchesService — toss (§11.2)', () => {
  it('records the toss and moves to Toss Completed', async () => {
    const { service, prisma } = buildService();
    prisma.match.findUnique.mockResolvedValue(matchRow({ state: MatchState.PlayingXiLocked }));
    prisma.match.update.mockResolvedValue({});

    await service.recordToss('match-1', { tossWinner: 'TEAM_A', decision: 'BAT' });

    expect(prisma.match.update).toHaveBeenCalledWith({
      where: { id: 'match-1' },
      data: { tossWinner: 'TEAM_A', tossDecision: 'BAT', state: MatchState.TossCompleted },
    });
  });

  it('rejects the toss before the XI is locked', async () => {
    const { service, prisma } = buildService();
    prisma.match.findUnique.mockResolvedValue(matchRow({ state: MatchState.Scheduled }));
    await expect(
      service.recordToss('match-1', { tossWinner: 'TEAM_A', decision: 'BAT' }),
    ).rejects.toMatchObject({ response: { error: 'INVALID_MATCH_STATE' } });
  });
});

describe('MatchesService — scorer assignment (§11.1)', () => {
  it('uses the Captain grant (ASSIGN_MATCH_SCORER) for ACC matches', async () => {
    const { service, prisma, permissions, scorerGrants } = buildService();
    prisma.match.findUnique.mockResolvedValue(
      matchRow({ tournament: { impactPlayerEnabled: false, type: 'ACC' } }),
    );

    await service.assignScorer(actor, 'match-1', { userId: 'scorer-1' });

    expect(permissions.check).toHaveBeenCalledWith(Permission.ASSIGN_MATCH_SCORER, actor, {
      matchId: 'match-1',
    });
    expect(scorerGrants.grant).toHaveBeenCalledWith('match-1', 'scorer-1', actor.id);
  });

  it('uses the organizer grant (ASSIGN_TOURNAMENT_SCORER) for APL matches', async () => {
    const { service, prisma, permissions } = buildService();
    prisma.match.findUnique.mockResolvedValue(
      matchRow({ tournament: { impactPlayerEnabled: false, type: 'APL' } }),
    );

    await service.assignScorer(actor, 'match-1', { userId: 'scorer-1' });

    expect(permissions.check).toHaveBeenCalledWith(Permission.ASSIGN_TOURNAMENT_SCORER, actor, {
      matchId: 'match-1',
    });
  });

  it('revokes the outgoing scorer and grants the incoming one on handover', async () => {
    const { service, prisma, scorerGrants } = buildService();
    prisma.match.findUnique.mockResolvedValue(matchRow({ state: MatchState.Live }));

    await service.handoverScorer(actor, 'match-1', { fromUserId: 'old', toUserId: 'new' });

    expect(scorerGrants.revoke).toHaveBeenCalledWith('match-1', 'old');
    expect(scorerGrants.grant).toHaveBeenCalledWith('match-1', 'new', actor.id);
  });
});

describe('LockPlayingXiDto validation', () => {
  it('rejects a Playing 11 that is not exactly 11 players', () => {
    const dto = plainToInstance(LockPlayingXiDto, {
      teamId: 'team-H',
      playingXi: xi('p', 10),
      substitutes: [],
    });
    expect(validateSync(dto).length).toBeGreaterThan(0);
  });

  it('rejects more than two substitutes', () => {
    const dto = plainToInstance(LockPlayingXiDto, {
      teamId: 'team-H',
      playingXi: xi('p', 11),
      substitutes: xi('s', 3),
    });
    expect(validateSync(dto).length).toBeGreaterThan(0);
  });

  it('accepts a valid 11 + 2 squad', () => {
    const dto = plainToInstance(LockPlayingXiDto, {
      teamId: 'team-H',
      playingXi: xi('p', 11),
      substitutes: xi('s', 2),
    });
    expect(validateSync(dto)).toHaveLength(0);
  });
});
