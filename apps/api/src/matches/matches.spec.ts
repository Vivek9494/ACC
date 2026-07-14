import 'reflect-metadata';

import {
  type AuthUser,
  formatMatchDelayMinutes,
  getMatchDetailStatusTransitions,
  MatchState,
  Permission,
  TournamentType,
  UserRole,
  validateMatchDetailStatusTransition,
} from '@acc/types';
import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { LockPlayingXiDto } from './dto/lock-playing-xi.dto';
import { MatchesService } from './matches.service';

type AnyMock = jest.Mock;

interface PrismaMock {
  tournament: { findUnique: AnyMock };
  match: {
    findUnique: AnyMock;
    findFirst: AnyMock;
    create: AnyMock;
    update: AnyMock;
    findMany: AnyMock;
    count: AnyMock;
  };
  team: { count: AnyMock };
  teamMembership: { findMany: AnyMock };
  registration: { findMany: AnyMock };
  suspension: { findMany: AnyMock };
  user: { findMany: AnyMock; findFirst: AnyMock };
  roleAssignment: { findFirst: AnyMock };
  matchSquad: { findUnique: AnyMock; findMany: AnyMock; create: AnyMock; update: AnyMock; count: AnyMock };
  matchSquadPlayer: { deleteMany: AnyMock; createMany: AnyMock };
  externalPlayer: {
    findMany: AnyMock;
    findUnique: AnyMock;
    create: AnyMock;
    delete: AnyMock;
    count: AnyMock;
    aggregate: AnyMock;
  };
  delivery: { count: AnyMock };
  innings: { findFirst: AnyMock; update: AnyMock };
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

function finalizedSquads(
  homeTeamId = 'team-H',
  awayTeamId = 'team-A',
): {
  teamId: string;
  isFinalized: boolean;
  players: { role: string }[];
  team: { name: string };
}[] {
  const players = xi('p', 11).map(() => ({ role: 'PLAYING_XI' }));
  return [
    { teamId: homeTeamId, isFinalized: true, players, team: { name: 'Home' } },
    { teamId: awayTeamId, isFinalized: true, players, team: { name: 'Away' } },
  ];
}

function buildService(): {
  service: MatchesService;
  prisma: PrismaMock;
  permissions: { check: AnyMock };
  scorerGrants: Record<string, AnyMock>;
  notifications: { notify: AnyMock; sendNotification: AnyMock; sendToAudience: AnyMock };
  scoring: { startInnings: AnyMock };
  tennisMatchScoringAuth: { assertCanRecordToss: AnyMock };
  live: { notifyScorerRevoked: AnyMock; notifyScorerAssigned: AnyMock; getCached: AnyMock };
  scorecardReader: { build: AnyMock };
} {
  const prisma: PrismaMock = {
    tournament: { findUnique: jest.fn() },
    match: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    team: { count: jest.fn().mockResolvedValue(2) },
    teamMembership: { findMany: jest.fn().mockResolvedValue([]) },
    registration: { findMany: jest.fn().mockResolvedValue([]) },
    suspension: { findMany: jest.fn().mockResolvedValue([]) },
    user: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue({ id: 'scorer-1' }) },
    roleAssignment: { findFirst: jest.fn().mockResolvedValue(null) },
    matchSquad: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
    matchSquadPlayer: { deleteMany: jest.fn(), createMany: jest.fn() },
    externalPlayer: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn().mockResolvedValue({ _max: { slot: 0 } }),
    },
    delivery: { count: jest.fn().mockResolvedValue(0) },
    innings: { findFirst: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  };

  prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(prisma));
  prisma.match.findFirst.mockImplementation((...args: unknown[]) =>
    prisma.match.findUnique(...(args as [])),
  );

  const permissions = { check: jest.fn().mockResolvedValue(true) };
  const scorerGrants = {
    grant: jest.fn().mockResolvedValue(undefined),
    revoke: jest.fn().mockResolvedValue(undefined),
    revokeAllForMatch: jest.fn().mockResolvedValue(undefined),
    assignOrSwitch: jest.fn().mockResolvedValue(undefined),
    replaceActiveGrant: jest.fn().mockResolvedValue(undefined),
    hasActiveGrant: jest.fn().mockResolvedValue(false),
    getActiveGrant: jest.fn().mockResolvedValue(null),
  };
  const notifications = {
    notify: jest.fn().mockResolvedValue(undefined),
    sendNotification: jest.fn().mockResolvedValue(undefined),
    sendToAudience: jest.fn().mockResolvedValue(undefined),
  };
  const notificationAudience = {
    resolveTeamSquad: jest.fn().mockResolvedValue([]),
    resolveTeamPlaying11: jest.fn().mockResolvedValue([]),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const standings = { getStandings: jest.fn().mockResolvedValue({ tables: [], dataErrors: [] }) };
  const scoring = { startInnings: jest.fn().mockResolvedValue(undefined) };
  const mediaUrls = {
    resolveReadUrl: jest.fn(async (value: string | null) => value),
    resolveReadUrls: jest.fn(async (values: (string | null | undefined)[]) =>
      values.map((value) => value ?? null),
    ),
  };
  const tournamentScorers = {
    buildMatchTennisScorerView: jest.fn().mockResolvedValue(null),
    assertCanManage: jest.fn().mockResolvedValue(undefined),
    assertUserInCurrentScorerSet: jest.fn().mockResolvedValue(undefined),
    viewerCanManageScorers: jest.fn().mockResolvedValue(false),
  };
  const tennisMatchScoringAuth = {
    assertCanRecordToss: jest.fn().mockResolvedValue(undefined),
  };
  const live = {
    notifyScorerRevoked: jest.fn(),
    notifyScorerAssigned: jest.fn(),
    getCached: jest.fn().mockResolvedValue(null),
  };
  const scorecardReader = {
    build: jest.fn().mockResolvedValue({ innings: [], result: { winningTeamId: null } }),
  };

  const service = new MatchesService(
    prisma as never,
    permissions as never,
    scorerGrants as never,
    notifications as never,
    notificationAudience as never,
    audit as never,
    standings as never,
    scoring as never,
    mediaUrls as never,
    tournamentScorers as never,
    tennisMatchScoringAuth as never,
    live as never,
    scorecardReader as never,
    { markRemainingPendingAsServed: jest.fn(), assertPlayingXiExcludesPendingSuspensions: jest.fn(), listPenaltyServingForSquads: jest.fn().mockResolvedValue(new Map()), generateForCompletedMatch: jest.fn() } as never,
  );
  return { service, prisma, permissions, scorerGrants, notifications, scoring, tennisMatchScoringAuth, live, scorecardReader };
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
    delayMinutes: 0,
    reportingTime: null,
    groundLocation: null,
    homeAway: null,
    youtubeUrl: null,
    tossWinner: null,
    tossDecision: null,
    homeTeam: { name: 'Home' },
    awayTeam: null,
    tournament: { impactPlayerEnabled: false, type: TournamentType.ACC, ballType: 'LEATHER', timezone: null },
    squads: [],
    scorerGrants: [],
    externalPlayers: [],
    ...overrides,
  };
}

function matchDayRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const matchDateIso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const startTime = new Date(Date.now() + 15 * 60 * 1000);
  return matchRow({
    matchDate: new Date(`${matchDateIso}T00:00:00.000Z`),
    startTime,
    ...overrides,
  });
}

function listRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'match-1',
    tournamentId: 'tour-1',
    matchCode: 'M1',
    state: MatchState.Scheduled,
    homeTeamId: 'team-H',
    awayTeamId: 'team-A',
    externalOpponentName: null,
    matchDate: new Date('2026-06-30T00:00:00.000Z'),
    startTime: null,
    groundLocation: null,
    completedAt: null,
    isDeleted: false,
    deletedAt: null,
    deletedById: null,
    winningTeamId: null,
    isNoResult: false,
    resultNote: null,
    homeTeam: { name: 'Home', logoUrl: null },
    awayTeam: { name: 'Away', logoUrl: null },
    ...overrides,
  };
}

describe('MatchesService — tournament match list', () => {
  it('excludes soft-deleted matches for non-admin viewers', async () => {
    const { service, prisma } = buildService();
    prisma.match.findMany.mockResolvedValue([]);

    await service.list('tour-1', undefined, actor);

    expect(prisma.match.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tournamentId: 'tour-1', isDeleted: false }),
      }),
    );
  });

  it('includes soft-deleted matches for admin viewers with deleter attribution', async () => {
    const admin: AuthUser = { ...actor, role: 'ADMIN' as AuthUser['role'] };
    const { service, prisma } = buildService();
    prisma.match.findMany.mockResolvedValue([
      listRow({ isDeleted: true, deletedAt: new Date('2026-07-01T12:00:00.000Z'), deletedById: 'admin-1' }),
    ]);
    prisma.user.findMany.mockResolvedValue([
      { id: 'admin-1', firstName: 'Ada', lastName: 'Min' },
    ]);

    const items = await service.list('tour-1', undefined, admin);

    expect(prisma.match.findMany.mock.calls[0]?.[0]?.where?.isDeleted).toBeUndefined();
    expect(items[0]?.isDeleted).toBe(true);
    expect(items[0]?.deletedByName).toBe('Ada Min');
    expect(items[0]?.deletedAt).toBe('2026-07-01T12:00:00.000Z');
  });
});

describe('formatMatchDelayMinutes', () => {
  it('formats preset and cumulative totals', () => {
    expect(formatMatchDelayMinutes(30)).toBe('30 mins');
    expect(formatMatchDelayMinutes(60)).toBe('1 hour');
    expect(formatMatchDelayMinutes(90)).toBe('1.30 hours');
    expect(formatMatchDelayMinutes(150)).toBe('2.30 hours');
    expect(formatMatchDelayMinutes(210)).toBe('3.30 hours');
    expect(formatMatchDelayMinutes(360)).toBe('6 hours');
    expect(formatMatchDelayMinutes(75)).toBe('1 hour 15 mins');
  });
});

describe('MatchesService — apply delay', () => {
  const clubManager: AuthUser = {
    ...actor,
    role: UserRole.ClubManager,
  };

  function todayMatchSchedule(): { matchDate: Date; startTime: Date } {
    const matchDateIso = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Toronto',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    return {
      matchDate: new Date(`${matchDateIso}T00:00:00.000Z`),
      startTime: new Date(`${matchDateIso}T22:00:00.000Z`),
    };
  }

  it('adds cumulative delay and sets Delayed without changing startTime', async () => {
    const { matchDate, startTime } = todayMatchSchedule();
    const { service, prisma } = buildService();
    prisma.match.findUnique.mockResolvedValue(
      matchRow({ state: MatchState.Scheduled, matchDate, startTime, delayMinutes: 60 }),
    );
    prisma.match.update.mockResolvedValue({});

    await service.applyDelay(clubManager, 'match-1', 30);

    expect(prisma.match.update).toHaveBeenCalledWith({
      where: { id: 'match-1' },
      data: { delayMinutes: 90, state: MatchState.Delayed },
    });
  });

  it('rejects delay on a future match day', async () => {
    const { service, prisma } = buildService();
    prisma.match.findUnique.mockResolvedValue(
      matchRow({
        state: MatchState.Scheduled,
        matchDate: '2026-12-31',
        startTime: new Date('2026-12-31T18:00:00.000Z'),
        delayMinutes: 0,
      }),
    );

    await expect(service.applyDelay(clubManager, 'match-1', 30)).rejects.toMatchObject({
      response: { error: 'MATCH_NOT_MATCH_DAY' },
    });
  });

  it('rejects delay from non Admin/Club Manager', async () => {
    const { matchDate, startTime } = todayMatchSchedule();
    const { service, prisma } = buildService();
    prisma.match.findUnique.mockResolvedValue(
      matchRow({ state: MatchState.Scheduled, matchDate, startTime, delayMinutes: 0 }),
    );

    await expect(service.applyDelay(actor, 'match-1', 30)).rejects.toMatchObject({
      response: { error: 'FORBIDDEN' },
    });
  });

  it('rejects generic transition to Delayed', async () => {
    const { service, prisma } = buildService();
    prisma.match.findUnique.mockResolvedValue(matchRow({ state: MatchState.Scheduled }));

    await expect(service.transition(actor, 'match-1', MatchState.Delayed)).rejects.toMatchObject({
      response: { error: 'USE_DEDICATED_ENDPOINT' },
    });
  });
});

describe('getMatchDetailStatusTransitions', () => {
  const TZ = 'America/Toronto';
  const nowMatchDay = new Date('2026-06-30T16:00:00.000Z');
  const nowFuture = new Date('2026-06-29T16:00:00.000Z');
  const nowPast = new Date('2026-07-02T16:00:00.000Z');

  const matchDayInput = {
    matchDate: '2026-06-30',
    startTime: '2026-06-30T17:00:00.000Z',
    timeZone: TZ,
    now: nowMatchDay,
  };

  const futureInput = {
    matchDate: '2026-07-03',
    startTime: '2026-07-03T17:00:00.000Z',
    timeZone: TZ,
    now: nowFuture,
  };

  const pastInput = {
    matchDate: '2026-06-28',
    startTime: '2026-06-28T17:00:00.000Z',
    timeZone: TZ,
    now: nowPast,
  };

  it('future pre-live shows Cancelled only (no Live, no Delayed)', () => {
    expect(
      getMatchDetailStatusTransitions({ state: MatchState.Scheduled, ...futureInput }),
    ).toEqual([MatchState.Cancelled]);
    expect(
      getMatchDetailStatusTransitions({ state: MatchState.TossCompleted, ...futureInput }),
    ).toEqual([MatchState.Cancelled]);
    expect(
      getMatchDetailStatusTransitions({ state: MatchState.Delayed, ...futureInput }),
    ).toEqual([MatchState.Cancelled]);
  });

  it('match-day pre-live shows Delayed and Cancelled; Live when graph allows', () => {
    expect(
      getMatchDetailStatusTransitions({ state: MatchState.Scheduled, ...matchDayInput }),
    ).toEqual([MatchState.Delayed, MatchState.Cancelled]);
    expect(
      getMatchDetailStatusTransitions({ state: MatchState.PlayingXiLocked, ...matchDayInput }),
    ).toEqual([MatchState.Delayed, MatchState.Cancelled]);
    expect(
      getMatchDetailStatusTransitions({ state: MatchState.TossCompleted, ...matchDayInput }),
    ).toEqual([MatchState.Delayed, MatchState.Live, MatchState.Cancelled]);
    expect(
      getMatchDetailStatusTransitions({ state: MatchState.Delayed, ...matchDayInput }),
    ).toEqual([MatchState.Delayed, MatchState.Live, MatchState.Cancelled]);
  });

  it('past-date pre-live shows Cancelled only', () => {
    expect(
      getMatchDetailStatusTransitions({ state: MatchState.Scheduled, ...pastInput }),
    ).toEqual([MatchState.Cancelled]);
    expect(
      getMatchDetailStatusTransitions({ state: MatchState.TossCompleted, ...pastInput }),
    ).toEqual([MatchState.Cancelled]);
  });

  it('shows in-play options without Delayed once Live or Rain Interrupted', () => {
    expect(
      getMatchDetailStatusTransitions({ state: MatchState.Live, ...matchDayInput }),
    ).toEqual([
      MatchState.RainInterrupted,
      MatchState.Completed,
      MatchState.NoResult,
      MatchState.Cancelled,
    ]);
    expect(
      getMatchDetailStatusTransitions({ state: MatchState.RainInterrupted, ...matchDayInput }),
    ).toEqual([
      MatchState.Live,
      MatchState.Completed,
      MatchState.NoResult,
      MatchState.Cancelled,
    ]);
  });

  it('returns no options for terminal states', () => {
    expect(getMatchDetailStatusTransitions({ state: MatchState.Completed, ...matchDayInput })).toEqual([]);
    expect(getMatchDetailStatusTransitions({ state: MatchState.Cancelled, ...matchDayInput })).toEqual([]);
  });

  it('validateMatchDetailStatusTransition rejects Live on future dates', () => {
    expect(
      validateMatchDetailStatusTransition({
        state: MatchState.TossCompleted,
        target: MatchState.Live,
        ...futureInput,
      }),
    ).toMatchObject({ ok: false, error: 'MATCH_NOT_MATCH_DAY' });
  });
});

describe('MatchesService — state machine (§5.2)', () => {
  it('rejects Live via status endpoint when schedule is not on match day', async () => {
    const { service, prisma } = buildService();
    prisma.match.findUnique.mockResolvedValue(
      matchRow({
        state: MatchState.TossCompleted,
        matchDate: '2026-12-31',
        startTime: new Date('2026-12-31T18:00:00.000Z'),
      }),
    );
    await expect(service.transition(actor, 'match-1', MatchState.Live)).rejects.toMatchObject({
      response: { error: 'USE_DEDICATED_ENDPOINT' },
    });
  });

  it('rejects an illegal transition', async () => {
    const { service, prisma } = buildService();
    prisma.match.findUnique.mockResolvedValue(matchRow({ state: MatchState.Scheduled }));
    await expect(service.transition(actor, 'match-1', MatchState.Live)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it.each([
    MatchState.Completed,
    MatchState.NoResult,
    MatchState.RainInterrupted,
  ] as const)('rejects pre-live transition to %s from Scheduled', async (next) => {
    const { service, prisma } = buildService();
    prisma.match.findUnique.mockResolvedValue(matchRow({ state: MatchState.Scheduled }));
    await expect(service.transition(actor, 'match-1', next)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('allows Live → Completed once the match has started', async () => {
    const { service, prisma, permissions, scorerGrants } = buildService();
    permissions.check.mockResolvedValue(true);
    prisma.match.findUnique.mockResolvedValue(matchRow({ state: MatchState.Live }));
    prisma.match.update.mockResolvedValue({});

    await service.transition(actor, 'match-1', MatchState.Completed);

    expect(permissions.check).toHaveBeenCalledWith(Permission.UPDATE_MATCH_STATUS, actor, {
      matchId: 'match-1',
    });
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

  it('notifies the active scorer when a live match is cancelled', async () => {
    const { service, prisma, scorerGrants, live } = buildService();
    prisma.match.findUnique.mockResolvedValue(matchRow({ state: MatchState.Live }));
    prisma.match.update.mockResolvedValue({});
    scorerGrants.getActiveGrant!.mockResolvedValue({ userId: 'scorer-1' });

    await service.transition(actor, 'match-1', MatchState.Cancelled);

    expect(scorerGrants.revokeAllForMatch).toHaveBeenCalledWith('match-1');
    expect(live.notifyScorerRevoked).toHaveBeenCalledWith(
      'match-1',
      'scorer-1',
      'cancelled',
    );
  });

  it('rejects reaching Playing 11 Locked via the generic status endpoint', async () => {
    const { service, prisma } = buildService();
    prisma.match.findUnique.mockResolvedValue(matchRow({ state: MatchState.Scheduled }));
    await expect(
      service.transition(actor, 'match-1', MatchState.PlayingXiLocked),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects reaching Live via the generic status endpoint', async () => {
    const { service, prisma } = buildService();
    prisma.match.findUnique.mockResolvedValue(
      matchDayRow({ state: MatchState.TossCompleted }),
    );
    await expect(service.transition(actor, 'match-1', MatchState.Live)).rejects.toMatchObject({
      response: { error: 'USE_DEDICATED_ENDPOINT' },
    });
  });

  it('allows Rain Interrupted → Live to resume play', async () => {
    const { service, prisma, permissions } = buildService();
    permissions.check.mockResolvedValue(true);
    prisma.match.findUnique.mockResolvedValue(
      matchDayRow({ state: MatchState.RainInterrupted }),
    );
    prisma.match.update.mockResolvedValue({});

    await service.transition(actor, 'match-1', MatchState.Live);

    expect(prisma.match.update).toHaveBeenCalledWith({
      where: { id: 'match-1' },
      data: { state: MatchState.Live },
    });
  });

  it('checks UPDATE_MATCH_STATUS for Completed', async () => {
    const { service, prisma, permissions } = buildService();
    permissions.check.mockResolvedValue(true);
    prisma.match.findUnique.mockResolvedValue(matchRow({ state: MatchState.Live }));
    prisma.match.update.mockResolvedValue({});

    await service.transition(actor, 'match-1', MatchState.Completed);

    expect(permissions.check).toHaveBeenCalledWith(Permission.UPDATE_MATCH_STATUS, actor, {
      matchId: 'match-1',
    });
  });

  it('checks UPDATE_MATCH_STATUS for No Result', async () => {
    const { service, prisma, permissions } = buildService();
    permissions.check.mockResolvedValue(true);
    prisma.match.findUnique.mockResolvedValue(matchRow({ state: MatchState.RainInterrupted }));
    prisma.match.update.mockResolvedValue({});

    await service.transition(actor, 'match-1', MatchState.NoResult);

    expect(permissions.check).toHaveBeenCalledWith(Permission.UPDATE_MATCH_STATUS, actor, {
      matchId: 'match-1',
    });
  });

  it('rejects Live when UPDATE_MATCH_STATUS is denied', async () => {
    const { service, prisma, permissions } = buildService();
    permissions.check.mockResolvedValue(false);
    prisma.match.findUnique.mockResolvedValue(
      matchDayRow({ state: MatchState.RainInterrupted }),
    );

    await expect(service.transition(actor, 'match-1', MatchState.Live)).rejects.toMatchObject({
      response: { message: 'You do not have permission to set the match to LIVE', error: 'FORBIDDEN' },
    });
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
    prisma.externalPlayer.count.mockResolvedValue(11);
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
    expect(notifications.sendToAudience).toHaveBeenCalled();
  });

  it('rejects locking the other team\'s Playing 11 when not that team\'s captain/VC', async () => {
    const { service, prisma, permissions } = buildService();
    prisma.match.findUnique.mockResolvedValue(
      matchRow({ awayTeamId: 'team-A', awayTeam: { name: 'Away' } }),
    );
    prisma.roleAssignment.findFirst.mockResolvedValue(null);
    permissions.check.mockResolvedValue(false);

    await expect(
      service.lockPlayingXi(actor, 'match-1', {
        teamId: 'team-A',
        playingXi: xi('p', 11),
        substitutes: [],
      }),
    ).rejects.toMatchObject({ response: { error: 'FORBIDDEN' } });
  });

  it('allows Admin and Club Manager to confirm either team\'s Playing 11', async () => {
    const admin: AuthUser = { ...actor, role: UserRole.Admin };
    const clubManager: AuthUser = { ...actor, id: 'cm-1', role: UserRole.ClubManager };
    const playingXi = xi('p', 11);

    for (const user of [admin, clubManager]) {
      const { service, prisma, notifications } = buildService();
      prisma.match.findUnique.mockResolvedValue(
        matchRow({ awayTeamId: 'team-A', awayTeam: { name: 'Away' }, state: MatchState.Scheduled }),
      );
      prisma.teamMembership.findMany.mockResolvedValue(playingXi.map((userId) => ({ userId })));
      prisma.matchSquad.findUnique.mockResolvedValue(null);
      prisma.matchSquad.create.mockResolvedValue({ id: 'squad-1' });
      prisma.matchSquad.count.mockResolvedValue(2);
      prisma.externalPlayer.count.mockResolvedValue(11);
      prisma.match.update.mockResolvedValue({});

      await service.lockPlayingXi(user, 'match-1', {
        teamId: 'team-A',
        playingXi,
        substitutes: [],
      });

      expect(notifications.sendToAudience).toHaveBeenCalled();
    }
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

describe('MatchesService — finalize both Playing 11 (§11)', () => {
  it('finalizes both teams when each has exactly 11 starters', async () => {
    const { service, prisma, scorerGrants } = buildService();
    (scorerGrants.hasActiveGrant as jest.Mock).mockResolvedValue(true);
    prisma.match.findUnique.mockResolvedValue(
      matchRow({
        state: MatchState.Scheduled,
        homeTeamId: 'team-H',
        awayTeamId: 'team-A',
        awayTeam: { name: 'Away' },
      }),
    );
    prisma.teamMembership.findMany.mockResolvedValue(xi('p', 11).map((userId) => ({ userId })));
    prisma.matchSquad.findUnique.mockResolvedValue(null);
    prisma.matchSquad.create.mockResolvedValue({ id: 'squad-1' });
    prisma.matchSquad.count.mockResolvedValue(2);
    prisma.match.update.mockResolvedValue({});

    await service.finalizeBothPlayingXi(actor, 'match-1', {
      teams: [
        { teamId: 'team-H', playingXi: xi('p', 11), substitutes: [] },
        { teamId: 'team-A', playingXi: xi('p', 11), substitutes: [] },
      ],
    });

    expect(prisma.matchSquad.create).toHaveBeenCalledTimes(2);
  });

  it('names the other team when only one side has 11 selected', async () => {
    const { service, prisma, scorerGrants } = buildService();
    (scorerGrants.hasActiveGrant as jest.Mock).mockResolvedValue(true);
    prisma.match.findUnique.mockResolvedValue(
      matchRow({
        state: MatchState.Scheduled,
        homeTeamId: 'team-H',
        awayTeamId: 'team-A',
        homeTeam: { name: 'Home' },
        awayTeam: { name: 'Away' },
      }),
    );

    await expect(
      service.finalizeBothPlayingXi(actor, 'match-1', {
        teams: [
          { teamId: 'team-H', playingXi: xi('p', 11), substitutes: [] },
          { teamId: 'team-A', playingXi: xi('p', 10), substitutes: [] },
        ],
      }),
    ).rejects.toMatchObject({
      response: {
        error: 'INCOMPLETE_PLAYING_XI',
        message: "Please select Away's Playing 11",
      },
    });
  });

  it('rejects captain verifying both teams without scorer grant', async () => {
    const { service, prisma, scorerGrants } = buildService();
    (scorerGrants.hasActiveGrant as jest.Mock).mockResolvedValue(false);
    prisma.match.findUnique.mockResolvedValue(matchRow());

    await expect(
      service.finalizeBothPlayingXi(actor, 'match-1', {
        teams: [
          { teamId: 'team-H', playingXi: xi('p', 11), substitutes: [] },
          { teamId: 'team-A', playingXi: xi('p', 11), substitutes: [] },
        ],
      }),
    ).rejects.toMatchObject({ response: { error: 'FORBIDDEN' } });
  });
});

describe('MatchesService — toss (§11.2)', () => {
  it('records the toss and moves to Toss Completed', async () => {
    const { service, prisma, permissions } = buildService();
    permissions.check.mockResolvedValue(true);
    prisma.match.findUnique.mockResolvedValue(
      matchRow({ state: MatchState.PlayingXiLocked }),
    );
    prisma.match.update.mockResolvedValue({});

    await service.recordToss(actor, 'match-1', { tossWinner: 'TEAM_A', decision: 'BAT' });

    expect(permissions.check).toHaveBeenCalledWith(Permission.RECORD_TOSS, actor, {
      matchId: 'match-1',
    });
    expect(prisma.match.update).toHaveBeenCalledWith({
      where: { id: 'match-1' },
      data: { tossWinner: 'TEAM_A', tossDecision: 'BAT', state: MatchState.TossCompleted },
    });
  });

  it('rejects the toss before the XI is locked', async () => {
    const { service, prisma, permissions } = buildService();
    permissions.check.mockResolvedValue(true);
    prisma.match.findUnique.mockResolvedValue(matchRow({ state: MatchState.Scheduled }));
    await expect(
      service.recordToss(actor, 'match-1', { tossWinner: 'TEAM_A', decision: 'BAT' }),
    ).rejects.toMatchObject({ response: { error: 'INVALID_MATCH_STATE' } });
    expect(permissions.check).toHaveBeenCalledWith(Permission.RECORD_TOSS, actor, {
      matchId: 'match-1',
    });
  });

  it('delegates tennis authorization to TennisMatchScoringAuthService', async () => {
    const { service, prisma, tennisMatchScoringAuth } = buildService();
    prisma.match.findUnique.mockResolvedValue(
      matchRow({
        state: MatchState.PlayingXiLocked,
        tournament: { impactPlayerEnabled: false, type: TournamentType.APL, ballType: 'TENNIS' },
      }),
    );
    prisma.match.update.mockResolvedValue({});

    await service.recordToss(actor, 'match-1', { tossWinner: 'TEAM_A', decision: 'BAT' });

    expect(tennisMatchScoringAuth.assertCanRecordToss).toHaveBeenCalledWith(actor, 'match-1');
  });

  it('checks RECORD_TOSS permission for leather matches', async () => {
    const { service, prisma, permissions, tennisMatchScoringAuth } = buildService();
    prisma.match.findUnique.mockResolvedValue(
      matchRow({ state: MatchState.PlayingXiLocked, tournament: { impactPlayerEnabled: false, type: TournamentType.ACC, ballType: 'LEATHER' } }),
    );
    permissions.check.mockResolvedValue(false);
    await expect(
      service.recordToss(actor, 'match-1', { tossWinner: 'TEAM_A', decision: 'BAT' }),
    ).rejects.toMatchObject({ response: { error: 'FORBIDDEN' } });
    expect(tennisMatchScoringAuth.assertCanRecordToss).not.toHaveBeenCalled();
    expect(permissions.check).toHaveBeenCalledWith(Permission.RECORD_TOSS, actor, {
      matchId: 'match-1',
    });
  });
});

describe('MatchesService — start scoring (§11.2)', () => {
  it('records toss, goes Live, and opens innings 1', async () => {
    const { service, prisma, permissions, scoring } = buildService();
    permissions.check.mockResolvedValue(true);
    const row = matchDayRow({
      state: MatchState.PlayingXiLocked,
      homeTeamId: 'team-H',
      awayTeamId: 'team-A',
      oversPerInnings: 20,
      scorecardVersion: 0,
    });
    prisma.match.findUnique.mockResolvedValue(row);
    prisma.matchSquad.findMany.mockResolvedValue(finalizedSquads('team-H', 'team-A'));
    prisma.innings.findFirst.mockResolvedValue(null);
    prisma.match.update.mockResolvedValue({});

    await service.startScoring(actor, 'match-1', { tossWinner: 'TEAM_A', decision: 'BAT' });

    expect(permissions.check).toHaveBeenCalledWith(Permission.START_MATCH, actor, {
      matchId: 'match-1',
    });
    expect(prisma.match.update).toHaveBeenCalledWith({
      where: { id: 'match-1' },
      data: expect.objectContaining({
        tossWinner: 'TEAM_A',
        tossDecision: 'BAT',
        state: MatchState.Live,
      }),
    });
    expect(scoring.startInnings).toHaveBeenCalledWith(
      actor,
      'match-1',
      expect.objectContaining({
        battingTeamId: 'team-H',
        bowlingTeamId: 'team-A',
      }),
    );
  });

  it('requires both teams finalized before start scoring from Scheduled', async () => {
    const { service, prisma, permissions } = buildService();
    permissions.check.mockResolvedValue(true);
    prisma.match.findUnique.mockResolvedValue(
      matchRow({ state: MatchState.Scheduled, homeTeamId: 'team-H', awayTeamId: 'team-A' }),
    );
    prisma.matchSquad.findMany.mockResolvedValue([]);

    await expect(
      service.startScoring(actor, 'match-1', { tossWinner: 'TEAM_A', decision: 'BAT' }),
    ).rejects.toMatchObject({ response: { error: 'PLAYING_XI_NOT_FINALIZED' } });
  });

  it('rejects start scoring before the 30-minute pre-start window', async () => {
    const { service, prisma, permissions } = buildService();
    permissions.check.mockResolvedValue(true);
    const row = matchDayRow({
      state: MatchState.PlayingXiLocked,
      homeTeamId: 'team-H',
      awayTeamId: 'team-A',
      startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
    });
    prisma.match.findUnique.mockResolvedValue(row);
    prisma.matchSquad.findMany.mockResolvedValue(finalizedSquads('team-H', 'team-A'));

    await expect(
      service.startScoring(actor, 'match-1', { tossWinner: 'TEAM_A', decision: 'BAT' }),
    ).rejects.toMatchObject({ response: { error: 'MATCH_START_TOO_EARLY' } });
  });

  it('rolls back match state when opening innings 1 fails', async () => {
    const { service, prisma, permissions, scoring } = buildService();
    permissions.check.mockResolvedValue(true);
    const row = matchDayRow({
      state: MatchState.PlayingXiLocked,
      homeTeamId: 'team-H',
      awayTeamId: 'team-A',
      oversPerInnings: 20,
      scorecardVersion: 0,
    });
    prisma.match.findUnique.mockResolvedValue(row);
    prisma.matchSquad.findMany.mockResolvedValue(finalizedSquads('team-H', 'team-A'));
    prisma.innings.findFirst.mockResolvedValue(null);
    prisma.match.update.mockResolvedValue({});
    scoring.startInnings.mockRejectedValue(new Error('version conflict'));

    await expect(
      service.startScoring(actor, 'match-1', { tossWinner: 'TEAM_A', decision: 'BAT' }),
    ).rejects.toThrow('version conflict');

    expect(prisma.match.update).toHaveBeenLastCalledWith({
      where: { id: 'match-1' },
      data: { state: MatchState.PlayingXiLocked },
    });
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
    expect(scorerGrants.assignOrSwitch).toHaveBeenCalledWith('match-1', 'scorer-1', actor.id);
  });

  it('uses assignOrSwitch for switch (same owning captain)', async () => {
    const { service, prisma, permissions, scorerGrants } = buildService();
    prisma.match.findUnique.mockResolvedValue(
      matchRow({ tournament: { impactPlayerEnabled: false, type: 'ACC' } }),
    );
    permissions.check.mockResolvedValue(true);

    await service.assignScorer(actor, 'match-1', { userId: 'scorer-2' });

    expect(scorerGrants.assignOrSwitch).toHaveBeenCalledWith('match-1', 'scorer-2', actor.id);
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

  it('swaps the tennis scorer mid-match for Admin/Club Manager only', async () => {
    const admin: AuthUser = { ...actor, id: 'admin-1', role: 'ADMIN' as AuthUser['role'] };
    const { service, prisma, scorerGrants, live, notifications } = buildService();
    prisma.match.findUnique.mockResolvedValue(
      matchRow({
        state: MatchState.Live,
        tournament: { impactPlayerEnabled: false, type: TournamentType.APL, ballType: 'TENNIS' },
      }),
    );
    scorerGrants.getActiveGrant!.mockResolvedValue({ userId: 'scorer-old' });

    await service.swapMatchScorer(admin, 'match-1', { userId: 'scorer-new' });

    expect(scorerGrants.replaceActiveGrant).toHaveBeenCalledWith('match-1', 'scorer-new', admin.id);
    expect(live.notifyScorerRevoked).toHaveBeenCalledWith('match-1', 'scorer-old', 'swap');
    expect(live.notifyScorerAssigned).toHaveBeenCalledWith('scorer-new', 'match-1');
    expect(notifications.notify).toHaveBeenCalled();
  });

  it('rejects mid-match swap for non-admin roles', async () => {
    const { service } = buildService();
    await expect(service.swapMatchScorer(actor, 'match-1', { userId: 'scorer-new' })).rejects.toMatchObject({
      response: { error: 'FORBIDDEN' },
    });
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
