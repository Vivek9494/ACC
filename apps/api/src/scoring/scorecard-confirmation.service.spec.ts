import 'reflect-metadata';

import {
  type AuthUser,
  InningsType,
  type MatchResultView,
  ScorecardAuditAction,
  SCORECARD_CONFIRM_WINDOW_MS,
  SYSTEM_ACTOR_LABEL,
  type BatterCard,
  type InningsScorecard,
} from '@acc/types';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { ScorecardConfirmationService } from './scorecard-confirmation.service';

const captain: AuthUser = {
  id: 'cap-1',
  firstName: 'Cap',
  lastName: 'Tain',
  mobileNumber: '+15555550001',
  email: 'c@acc.local',
  centerId: 'c1',
  jerseyNumber: 7,
  profilePhotoUrl: null,
  role: 'CAPTAIN' as AuthUser['role'],
  isActive: true,
};

const viceCaptain: AuthUser = {
  id: 'vc-1',
  firstName: 'Vice',
  lastName: 'Captain',
  mobileNumber: '+15555550002',
  email: 'vc@acc.local',
  centerId: 'c1',
  jerseyNumber: 8,
  profilePhotoUrl: null,
  role: 'VICE_CAPTAIN' as AuthUser['role'],
  isActive: true,
};

interface Row {
  [key: string]: unknown;
}

function decided(winner: string | null, isNoResult = false): MatchResultView {
  return {
    decided: winner !== null && !isNoResult,
    isTie: false,
    isNoResult,
    winningTeamId: winner,
    marginRuns: winner ? 10 : null,
    marginWickets: null,
    superOverRequired: false,
    note: 'note',
  };
}

function minimalBatter(playerId: string): BatterCard {
  return {
    playerId,
    runs: 10,
    balls: 5,
    ones: 0,
    twos: 0,
    threes: 0,
    fours: 1,
    sixes: 0,
    strikeRate: 200,
    isOut: false,
    dismissalType: null,
    bowlerId: null,
    fielderId: null,
    fielder2Id: null,
    retiredHurt: false,
    isMankad: false,
  };
}

function inningsWithBatters(playerIds: string[]): InningsScorecard[] {
  if (playerIds.length === 0) return [];
  return [
    {
      inningsId: 'i1',
      sequence: 1,
      inningsType: InningsType.Normal,
      battingTeamId: 'home',
      bowlingTeamId: 'away',
      runs: 100,
      wickets: 2,
      legalBalls: 60,
      oversText: '10.0',
      oversAllotted: 25,
      extras: { byes: 0, legByes: 0, wides: 0, noBalls: 0, penalties: 0, total: 0 },
      batters: playerIds.map(minimalBatter),
      bowlers: [],
      fallOfWickets: [],
      recentOvers: [],
      timeline: [],
      partnership: null,
      partnerships: [],
      currentStrikerId: null,
      currentNonStrikerId: null,
      currentBowlerId: null,
      freeHitNext: false,
      closed: true,
      closeReason: null,
      target: null,
      droppedCatches: [],
      droppedCatchEvents: [],
    },
  ];
}

function makeHarness(
  result: MatchResultView = decided('home'),
  options?: { omitMomFigures?: boolean },
) {
  const matches = new Map<string, Row>();
  const squadPlayers: { userId: string; matchId: string; teamId: string }[] = [];
  const roleAssignments: {
    userId: string;
    role: string;
    teamId: string;
    tournamentId: string;
  }[] = [];
  const audits: Row[] = [];
  const grantUpdates: Row[] = [];
  const published: string[] = [];
  const resultRef = { value: result };

  const prisma = {
    match: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const m = matches.get(where.id);
        return m ? { ...m } : null;
      },
      findFirst: async ({
        where,
        include,
      }: {
        where: { id?: string; isDeleted?: boolean };
        include?: { tournament?: { select: { type: true } } };
      }) => {
        if (!where.id) {
          return null;
        }
        const m = matches.get(where.id);
        if (!m) {
          return null;
        }
        if (where.isDeleted === false && m.isDeleted === true) {
          return null;
        }
        const row = { ...m };
        if (include?.tournament) {
          return { ...row, tournament: { type: 'ACC' } };
        }
        return row;
      },
      findMany: async ({
        where,
      }: {
        where: {
          state?: { in: string[] };
          adminConfirmed?: boolean;
          OR?: { homeTeamId?: { in: string[] }; awayTeamId?: { in: string[] } }[];
          completedAt?: { lte: Date };
        };
      }) =>
        [...matches.values()].filter((m) => {
          if (where.state?.in && !where.state.in.includes(m.state as string)) {
            return false;
          }
          if (where.adminConfirmed === false && m.adminConfirmed === true) {
            return false;
          }
          if (where.completedAt?.lte) {
            if (
              !(m.completedAt instanceof Date) ||
              (m.completedAt as Date).getTime() > where.completedAt.lte.getTime()
            ) {
              return false;
            }
          }
          if (where.OR) {
            const teamIds = new Set<string>();
            for (const clause of where.OR) {
              clause.homeTeamId?.in?.forEach((id) => teamIds.add(id));
              clause.awayTeamId?.in?.forEach((id) => teamIds.add(id));
            }
            const home = m.homeTeamId as string | null;
            const away = m.awayTeamId as string | null;
            if (![home, away].some((id) => id != null && teamIds.has(id))) {
              return false;
            }
          }
          return true;
        }),
      update: async ({ where, data }: { where: { id: string }; data: Row }) => {
        const m = matches.get(where.id) as Row;
        Object.assign(m, data);
        return { ...m };
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: {
          id?: string;
          isDeleted?: boolean;
          state?: { in: string[] };
          autoConfirmed?: boolean;
        };
        data: Row;
      }) => {
        let count = 0;
        for (const [matchId, match] of matches.entries()) {
          if (where.id != null && matchId !== where.id) {
            continue;
          }
          if (where.isDeleted === false && match.isDeleted === true) {
            continue;
          }
          if (where.state?.in && !where.state.in.includes(match.state as string)) {
            continue;
          }
          if (where.autoConfirmed === false && match.autoConfirmed === true) {
            continue;
          }
          Object.assign(match, data);
          count += 1;
        }
        return { count };
      },
    },
    matchScorerGrant: {
      updateMany: async (args: Row) => {
        grantUpdates.push(args);
        return { count: 0 };
      },
    },
    matchSquadPlayer: {
      findFirst: async ({
        where,
      }: {
        where: { userId: string; squad: { matchId: string; teamId?: string } };
      }) =>
        squadPlayers.find(
          (p) =>
            p.userId === where.userId &&
            p.matchId === where.squad.matchId &&
            (where.squad.teamId == null || p.teamId === where.squad.teamId),
        ) ?? null,
    },
    roleAssignment: {
      findFirst: async ({
        where,
      }: {
        where: {
          userId?: string;
          role?: string | { in: string[] };
          teamId?: string;
          tournamentId?: string;
        };
      }) =>
        roleAssignments.find(
          (row) =>
            (where.userId == null || row.userId === where.userId) &&
            (where.role == null ||
              (typeof where.role === 'string'
                ? row.role === where.role
                : where.role.in.includes(row.role))) &&
            (where.teamId == null || row.teamId === where.teamId) &&
            (where.tournamentId == null || row.tournamentId === where.tournamentId),
        ) ?? null,
      findMany: async ({
        where,
      }: {
        where: {
          userId?: string;
          teamId?: string;
          role?: { in: string[] };
        };
      }) =>
        roleAssignments.filter(
          (row) =>
            (where.userId == null || row.userId === where.userId) &&
            (where.teamId == null || row.teamId === where.teamId) &&
            (where.role?.in == null || where.role.in.includes(row.role)),
        ),
    },
    suspension: {
      findFirst: async () => null,
    },
    team: {
      findUnique: async () => ({ name: 'Home XI' }),
    },
    $transaction: async (cb: (tx: unknown) => unknown) => cb(prisma),
  };

  const audit = {
    record: async (entry: Row) => {
      audits.push(entry);
    },
  };
  const reader = {
    build: async (match: Row) => {
      const playerIds = options?.omitMomFigures
        ? []
        : [
            ...new Set(
              squadPlayers.filter((p) => p.matchId === match.id).map((p) => p.userId),
            ),
          ];
      return {
        matchId: match.id,
        version: match.scorecardVersion ?? 0,
        originalTarget: null,
        dlsTarget: null,
        effectiveTarget: null,
        innings: inningsWithBatters(playerIds),
        result: resultRef.value,
      };
    },
  };
  const live = {
    publish: async (card: { matchId: string }) => {
      published.push(card.matchId);
    },
  };
  const knockoutProgression = {
    advanceWinnerOnConfirmation: jest.fn().mockResolvedValue(undefined),
  };
  const notifications = {
    sendToAudience: jest.fn().mockResolvedValue(undefined),
    sendNotification: jest.fn().mockResolvedValue(undefined),
  };
  const notificationAudience = {
    resolveTeamSquad: jest.fn().mockResolvedValue([]),
  };

  const service = new ScorecardConfirmationService(
    prisma as never,
    audit as never,
    reader as never,
    live as never,
    knockoutProgression as never,
    notifications as never,
    notificationAudience as never,
  );
  return {
    service,
    matches,
    squadPlayers,
    roleAssignments,
    audits,
    grantUpdates,
    published,
    resultRef,
    knockoutProgression,
    notifications,
    notificationAudience,
  };
}

function seedMatch(matches: Map<string, Row>, overrides: Row = {}): void {
  matches.set('m1', {
    id: 'm1',
    tournamentId: 't1',
    homeTeamId: 'home',
    awayTeamId: 'away',
    state: 'COMPLETED',
    scorecardVersion: 3,
    isNoResult: false,
    winningTeamId: null,
    manOfTheMatchUserId: null,
    manOfTheMatchSelectedAt: null,
    manOfTheMatchSelectedByUserId: null,
    matchDate: new Date('2099-06-08T00:00:00.000Z'),
    completedAt: new Date(),
    confirmedAt: null,
    confirmedByUserId: null,
    autoConfirmed: false,
    homeTeamConfirmed: false,
    homeTeamConfirmedByUserId: null,
    homeTeamConfirmedAt: null,
    awayTeamConfirmed: false,
    awayTeamConfirmedByUserId: null,
    awayTeamConfirmedAt: null,
    adminConfirmed: false,
    adminConfirmedByUserId: null,
    adminConfirmedAt: null,
    tournament: { type: 'ACC' },
    ...overrides,
  });
}

describe('ScorecardConfirmationService — manual confirmation (§13.1)', () => {
  it('records home-team confirmation without locking until away confirms', async () => {
    const h = makeHarness(decided('home'));
    seedMatch(h.matches);
    h.roleAssignments.push({
      userId: captain.id,
      role: 'CAPTAIN',
      teamId: 'home',
      tournamentId: 't1',
    });

    const view = await h.service.confirm(captain, 'm1', 3);

    expect(view.state).toBe('COMPLETED');
    expect(view.homeTeamConfirmed).toBe(true);
    expect(view.awayTeamConfirmed).toBe(false);
    expect(view.scorecardFinalized).toBe(false);
    expect(h.grantUpdates.length).toBe(0);
  });

  it('locks once both teams have confirmed', async () => {
    const h = makeHarness(decided('home'));
    seedMatch(h.matches, { homeTeamConfirmed: true, homeTeamConfirmedByUserId: 'cap-1' });
    h.roleAssignments.push({
      userId: 'cap-away',
      role: 'CAPTAIN',
      teamId: 'away',
      tournamentId: 't1',
    });
    const awayCaptain: AuthUser = { ...captain, id: 'cap-away' };

    const view = await h.service.confirm(awayCaptain, 'm1', 3);

    expect(view.state).toBe('COMPLETED');
    expect(view.confirmedAt).not.toBeNull();
    expect(view.homeTeamConfirmed).toBe(true);
    expect(view.awayTeamConfirmed).toBe(true);
    expect(view.scorecardFinalized).toBe(true);
    expect(h.grantUpdates.length).toBe(1);
    expect(h.knockoutProgression.advanceWinnerOnConfirmation).toHaveBeenCalledTimes(1);
  });

  it('admin override finalizes outright', async () => {
    const h = makeHarness(decided('home'));
    seedMatch(h.matches);
    const admin: AuthUser = { ...captain, id: 'admin-1', role: 'ADMIN' as AuthUser['role'] };

    const view = await h.service.confirm(admin, 'm1', 3);

    expect(view.state).toBe('COMPLETED');
    expect(view.confirmedAt).not.toBeNull();
    expect(view.adminConfirmed).toBe(true);
    expect(view.scorecardFinalized).toBe(true);
  });

  it('notifies the winning team squad when the scorecard is confirmed (§17)', async () => {
    const h = makeHarness(decided('home'));
    seedMatch(h.matches);
    h.notificationAudience.resolveTeamSquad.mockResolvedValue(['u1', 'u2']);
    const admin: AuthUser = { ...captain, id: 'admin-1', role: 'ADMIN' as AuthUser['role'] };

    await h.service.confirm(admin, 'm1', 3);

    expect(h.notificationAudience.resolveTeamSquad).toHaveBeenCalledWith('home');
    expect(h.notifications.sendToAudience).toHaveBeenCalledWith(
      ['u1', 'u2'],
      expect.objectContaining({
        triggerKey: 'MATCH_RESULT_CONFIRMED',
        dedupeKey: 'MATCH_RESULT_CONFIRMED:m1',
        data: { matchId: 'm1', teamId: 'home', screen: 'match' },
      }),
    );
  });

  it('does not notify a winner on a no-result confirmation (§17)', async () => {
    const h = makeHarness(decided(null, true));
    seedMatch(h.matches);
    h.notificationAudience.resolveTeamSquad.mockResolvedValue(['u1']);
    const admin: AuthUser = { ...captain, id: 'admin-1', role: 'ADMIN' as AuthUser['role'] };

    await h.service.confirm(admin, 'm1', 3);

    expect(h.notifications.sendToAudience).not.toHaveBeenCalled();
  });

  it('rejects confirmation when the match is not awaiting it', async () => {
    const h = makeHarness();
    seedMatch(h.matches, { state: 'LIVE' });
    await expect(h.service.confirm(captain, 'm1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns the locked view idempotently when already finalized', async () => {
    const h = makeHarness();
    seedMatch(h.matches, { state: 'SCORECARD_LOCKED', homeTeamConfirmed: true, awayTeamConfirmed: true });
    const view = await h.service.confirm(captain, 'm1');
    expect(view.state).toBe('SCORECARD_LOCKED');
  });

  it('rejects a stale confirmation with the exact concurrency message', async () => {
    const h = makeHarness();
    seedMatch(h.matches, { scorecardVersion: 5 });
    h.roleAssignments.push({
      userId: captain.id,
      role: 'CAPTAIN',
      teamId: 'home',
      tournamentId: 't1',
    });
    await expect(h.service.confirm(captain, 'm1', 4)).rejects.toMatchObject({
      response: { message: 'Scorecard got updated.' },
    });
  });

  it('rejects confirmation from a user who is not an eligible leader', async () => {
    const h = makeHarness(decided('home'));
    seedMatch(h.matches);
    await expect(h.service.confirm(captain, 'm1', 3)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('is idempotent when the same team confirms again', async () => {
    const h = makeHarness(decided('home'));
    seedMatch(h.matches, { homeTeamConfirmed: true, homeTeamConfirmedByUserId: 'cap-1' });
    h.roleAssignments.push({
      userId: captain.id,
      role: 'CAPTAIN',
      teamId: 'home',
      tournamentId: 't1',
    });

    const view = await h.service.confirm(captain, 'm1', 3);
    expect(view.homeTeamConfirmed).toBe(true);
    expect(view.state).toBe('COMPLETED');
  });
});

describe('ScorecardConfirmationService — dashboard pending list (§13.1)', () => {
  it('returns matches awaiting the captain own-team confirmation', async () => {
    const h = makeHarness();
    seedMatch(h.matches, {
      homeTeam: { id: 'home', name: 'Lions' },
      awayTeam: { id: 'away', name: 'Sharks' },
      tournament: { name: 'APL 2026', type: 'APL' },
    });
    h.roleAssignments.push({
      userId: captain.id,
      role: 'CAPTAIN',
      teamId: 'home',
      tournamentId: 't1',
    });

    const pending = await h.service.listPendingDashboardConfirmations(captain);
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      matchId: 'm1',
      tournamentName: 'APL 2026',
      homeTeamName: 'Lions',
      awayTeamName: 'Sharks',
      confirmSide: 'HOME',
      homeTeamConfirmed: false,
    });
  });

  it('omits matches once the user team has confirmed', async () => {
    const h = makeHarness();
    seedMatch(h.matches, { homeTeamConfirmed: true, homeTeamConfirmedByUserId: 'cap-1' });
    h.roleAssignments.push({
      userId: captain.id,
      role: 'CAPTAIN',
      teamId: 'home',
      tournamentId: 't1',
    });

    const pending = await h.service.listPendingDashboardConfirmations(captain);
    expect(pending).toHaveLength(0);
  });

  it('returns empty for users without captain/VC assignments', async () => {
    const h = makeHarness();
    seedMatch(h.matches);

    const pending = await h.service.listPendingDashboardConfirmations(captain);
    expect(pending).toHaveLength(0);
  });
});

describe('ScorecardConfirmationService — auto-confirm (§13.1, §23)', () => {
  it('does nothing while still inside the 5-hour window', async () => {
    const h = makeHarness();
    seedMatch(h.matches, { completedAt: new Date(Date.now() - 60_000) });
    await h.service.evaluateAutoConfirm('m1');
    expect((h.matches.get('m1') as Row).state).toBe('COMPLETED');
  });

  it('locks with actor System once the window has elapsed', async () => {
    const h = makeHarness(decided('home'));
    seedMatch(h.matches, {
      completedAt: new Date(Date.now() - SCORECARD_CONFIRM_WINDOW_MS - 1000),
    });

    await h.service.evaluateAutoConfirm('m1');

    const row = h.matches.get('m1') as Row;
    expect(row.state).toBe('COMPLETED');
    expect(row.confirmedAt).not.toBeNull();
    expect(row.homeTeamConfirmed).toBe(true);
    expect(row.awayTeamConfirmed).toBe(true);
    expect(row.confirmedByUserId).toBeNull();
    expect(row.autoConfirmed).toBe(true);
    const entry = h.audits.find((a) => a.action === ScorecardAuditAction.AutoConfirmed);
    expect(entry?.actorLabel).toBe(SYSTEM_ACTOR_LABEL);
  });

  it('sweep auto-confirms every match past the window', async () => {
    const h = makeHarness();
    seedMatch(h.matches, {
      id: 'm1',
      completedAt: new Date(Date.now() - SCORECARD_CONFIRM_WINDOW_MS - 5000),
    });
    h.matches.set('m2', {
      ...(h.matches.get('m1') as Row),
      id: 'm2',
      state: 'NO_RESULT',
      isNoResult: true,
    });

    const count = await h.service.sweepAutoConfirm();
    expect(count).toBe(2);
    expect((h.matches.get('m2') as Row).state).toBe('NO_RESULT');
    expect((h.matches.get('m2') as Row).confirmedAt).not.toBeNull();
  });
});

describe('ScorecardConfirmationService — Man of the Match (§13.3)', () => {
  it('rejects MoTM for a winning-team player with no batting or bowling figures', async () => {
    const h = makeHarness(decided('home'), { omitMomFigures: true });
    seedMatch(h.matches);
    h.roleAssignments.push({
      userId: captain.id,
      role: 'CAPTAIN',
      teamId: 'home',
      tournamentId: 't1',
    });
    h.squadPlayers.push({ userId: 'p1', matchId: 'm1', teamId: 'home' });

    await expect(h.service.selectManOfMatch(captain, 'm1', 'p1')).rejects.toMatchObject({
      response: { error: 'PLAYER_NO_MATCH_FIGURES' },
    });
  });

  it('rejects a player not on the winning team', async () => {
    const h = makeHarness(decided('home'));
    seedMatch(h.matches);
    h.roleAssignments.push({
      userId: captain.id,
      role: 'CAPTAIN',
      teamId: 'home',
      tournamentId: 't1',
    });
    h.squadPlayers.push({ userId: 'p1', matchId: 'm1', teamId: 'away' });
    await expect(h.service.selectManOfMatch(captain, 'm1', 'p1')).rejects.toMatchObject({
      response: { error: 'PLAYER_NOT_ON_WINNING_TEAM' },
    });
  });

  it('rejects MoTM when there is no decided winner', async () => {
    const h = makeHarness(decided(null, true));
    seedMatch(h.matches, { isNoResult: true });
    h.roleAssignments.push({
      userId: captain.id,
      role: 'CAPTAIN',
      teamId: 'home',
      tournamentId: 't1',
    });
    h.squadPlayers.push({ userId: 'p1', matchId: 'm1', teamId: 'home' });
    await expect(h.service.selectManOfMatch(captain, 'm1', 'p1')).rejects.toMatchObject({
      response: { error: 'NO_DECIDED_WINNER' },
    });
  });

  it('rejects MoTM from a user who is not the winning captain or vice-captain', async () => {
    const h = makeHarness(decided('home'));
    seedMatch(h.matches);
    h.squadPlayers.push({ userId: 'p1', matchId: 'm1', teamId: 'home' });
    const outsider: AuthUser = { ...captain, id: 'other-1' };
    await expect(h.service.selectManOfMatch(outsider, 'm1', 'p1')).rejects.toMatchObject({
      response: { error: 'NOT_WINNING_CAPTAIN' },
    });
  });

  it('rejects MoTM from the losing team vice-captain', async () => {
    const h = makeHarness(decided('home'));
    seedMatch(h.matches);
    h.roleAssignments.push({
      userId: viceCaptain.id,
      role: 'VICE_CAPTAIN',
      teamId: 'away',
      tournamentId: 't1',
    });
    h.squadPlayers.push({ userId: 'p1', matchId: 'm1', teamId: 'home' });
    await expect(h.service.selectManOfMatch(viceCaptain, 'm1', 'p1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows MoTM from the winning-team vice-captain', async () => {
    const h = makeHarness(decided('home'));
    seedMatch(h.matches);
    h.roleAssignments.push({
      userId: viceCaptain.id,
      role: 'VICE_CAPTAIN',
      teamId: 'home',
      tournamentId: 't1',
    });
    h.squadPlayers.push({ userId: 'p1', matchId: 'm1', teamId: 'home' });

    const eligibility = await h.service.manOfMatchEligibility(viceCaptain, 'm1');
    expect(eligibility).toMatchObject({ offered: true, canSelect: true });

    const view = await h.service.selectManOfMatch(viceCaptain, 'm1', 'p1');
    expect(view.manOfTheMatchUserId).toBe('p1');
    expect(view.manOfTheMatchSelectedByUserId).toBe('vc-1');
  });

  it('allows the other leader to re-select the single MoM award', async () => {
    const h = makeHarness(decided('home'));
    seedMatch(h.matches);
    h.roleAssignments.push(
      { userId: captain.id, role: 'CAPTAIN', teamId: 'home', tournamentId: 't1' },
      { userId: viceCaptain.id, role: 'VICE_CAPTAIN', teamId: 'home', tournamentId: 't1' },
    );
    h.squadPlayers.push(
      { userId: 'p1', matchId: 'm1', teamId: 'home' },
      { userId: 'p2', matchId: 'm1', teamId: 'home' },
    );

    await h.service.selectManOfMatch(captain, 'm1', 'p1');
    const vcEligibility = await h.service.manOfMatchEligibility(viceCaptain, 'm1');
    expect(vcEligibility).toMatchObject({ offered: true, canSelect: true, required: false });

    const updated = await h.service.selectManOfMatch(viceCaptain, 'm1', 'p2');
    expect(updated.manOfTheMatchUserId).toBe('p2');
    expect(updated.manOfTheMatchSelectedByUserId).toBe('vc-1');
    expect((h.matches.get('m1') as Row).manOfTheMatchUserId).toBe('p2');
  });

  it('does not offer MoM when the winning team is not registered (external winner)', async () => {
    const h = makeHarness({
      decided: true,
      isTie: false,
      isNoResult: false,
      winningTeamId: null,
      marginRuns: 5,
      marginWickets: null,
      superOverRequired: false,
      note: 'External won',
    });
    seedMatch(h.matches);
    h.roleAssignments.push({
      userId: captain.id,
      role: 'CAPTAIN',
      teamId: 'home',
      tournamentId: 't1',
    });

    const eligibility = await h.service.manOfMatchEligibility(captain, 'm1');
    expect(eligibility).toMatchObject({ offered: false, canSelect: false });
  });

  it('allows MoTM for a winning-team player and audits it', async () => {
    const h = makeHarness(decided('home'));
    seedMatch(h.matches);
    h.roleAssignments.push({
      userId: captain.id,
      role: 'CAPTAIN',
      teamId: 'home',
      tournamentId: 't1',
    });
    h.squadPlayers.push({ userId: 'p1', matchId: 'm1', teamId: 'home' });

    const view = await h.service.selectManOfMatch(captain, 'm1', 'p1');
    expect(view.manOfTheMatchUserId).toBe('p1');
    expect(view.manOfTheMatchSelectedByUserId).toBe('cap-1');
    expect(view.manOfTheMatchSelectedAt).toBeTruthy();
    expect(h.audits.some((a) => a.action === ScorecardAuditAction.ManOfMatchSelected)).toBe(true);
  });

  it('marks MoM as required with an end-of-day deadline', async () => {
    const h = makeHarness(decided('home'));
    seedMatch(h.matches);
    h.roleAssignments.push({
      userId: captain.id,
      role: 'CAPTAIN',
      teamId: 'home',
      tournamentId: 't1',
    });

    const eligibility = await h.service.manOfMatchEligibility(captain, 'm1');
    expect(eligibility).toMatchObject({
      offered: true,
      canSelect: true,
      required: true,
      dueAt: '2099-06-08T23:59:59.999Z',
      overdue: false,
    });
  });

  it('allows re-select when MoM is already set', async () => {
    const h = makeHarness(decided('home'));
    seedMatch(h.matches, { manOfTheMatchUserId: 'p1' });
    h.roleAssignments.push({
      userId: captain.id,
      role: 'CAPTAIN',
      teamId: 'home',
      tournamentId: 't1',
    });
    h.squadPlayers.push({ userId: 'p1', matchId: 'm1', teamId: 'home' });
    h.squadPlayers.push({ userId: 'p2', matchId: 'm1', teamId: 'home' });

    const eligibility = await h.service.manOfMatchEligibility(captain, 'm1');
    expect(eligibility).toMatchObject({
      offered: true,
      canSelect: true,
      required: false,
    });

    const view = await h.service.selectManOfMatch(captain, 'm1', 'p2');
    expect(view.manOfTheMatchUserId).toBe('p2');
  });
});
