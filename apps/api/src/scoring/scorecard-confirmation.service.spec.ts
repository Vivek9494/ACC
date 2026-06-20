import 'reflect-metadata';

import {
  type AuthUser,
  type MatchResultView,
  ScorecardAuditAction,
  SCORECARD_CONFIRM_WINDOW_MS,
  SYSTEM_ACTOR_LABEL,
} from '@acc/types';
import { BadRequestException } from '@nestjs/common';

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

function makeHarness(result: MatchResultView = decided('home')) {
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
      update: async ({ where, data }: { where: { id: string }; data: Row }) => {
        const m = matches.get(where.id) as Row;
        Object.assign(m, data);
        return { ...m };
      },
      findMany: async ({
        where,
      }: {
        where: { state: { in: string[] }; completedAt: { lte: Date } };
      }) =>
        [...matches.values()].filter(
          (m) =>
            where.state.in.includes(m.state as string) &&
            m.completedAt instanceof Date &&
            (m.completedAt as Date).getTime() <= where.completedAt.lte.getTime(),
        ),
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
          role?: string;
          teamId?: string;
          tournamentId?: string;
        };
      }) =>
        roleAssignments.find(
          (row) =>
            (where.userId == null || row.userId === where.userId) &&
            (where.role == null || row.role === where.role) &&
            (where.teamId == null || row.teamId === where.teamId) &&
            (where.tournamentId == null || row.tournamentId === where.tournamentId),
        ) ?? null,
      findMany: async ({
        where,
      }: {
        where: { teamId?: string; role?: { in: string[] } };
      }) =>
        roleAssignments.filter(
          (row) =>
            (where.teamId == null || row.teamId === where.teamId) &&
            (where.role?.in == null || where.role.in.includes(row.role)),
        ),
    },
    suspension: {
      findFirst: async () => null,
    },
    $transaction: async (cb: (tx: unknown) => unknown) => cb(prisma),
  };

  const audit = {
    record: async (entry: Row) => {
      audits.push(entry);
    },
  };
  const reader = {
    build: async (match: Row) => ({
      matchId: match.id,
      version: match.scorecardVersion ?? 0,
      originalTarget: null,
      dlsTarget: null,
      effectiveTarget: null,
      innings: [],
      result: resultRef.value,
    }),
  };
  const live = {
    publish: async (card: { matchId: string }) => {
      published.push(card.matchId);
    },
  };

  const service = new ScorecardConfirmationService(
    prisma as never,
    audit as never,
    reader as never,
    live as never,
  );
  return { service, matches, squadPlayers, roleAssignments, audits, grantUpdates, published, resultRef };
}

function seedMatch(matches: Map<string, Row>, overrides: Row = {}): void {
  matches.set('m1', {
    id: 'm1',
    tournamentId: 't1',
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
    tournament: { type: 'ACC' },
    ...overrides,
  });
}

describe('ScorecardConfirmationService — manual confirmation (§13.1)', () => {
  it('locks a completed match and records the confirming user', async () => {
    const h = makeHarness(decided('home'));
    seedMatch(h.matches);

    const view = await h.service.confirm(captain, 'm1', 3);

    expect(view.state).toBe('SCORECARD_LOCKED');
    expect(view.confirmedByUserId).toBe('cap-1');
    expect(view.autoConfirmed).toBe(false);
    expect(view.winningTeamId).toBe('home');
    expect(h.audits.some((a) => a.action === ScorecardAuditAction.Confirmed)).toBe(true);
    // §11.1: lingering scorer grants are revoked at lock.
    expect(h.grantUpdates.length).toBe(1);
  });

  it('rejects confirmation when the match is not awaiting it', async () => {
    const h = makeHarness();
    seedMatch(h.matches, { state: 'LIVE' });
    await expect(h.service.confirm(captain, 'm1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects confirming an already-locked scorecard', async () => {
    const h = makeHarness();
    seedMatch(h.matches, { state: 'SCORECARD_LOCKED' });
    await expect(h.service.confirm(captain, 'm1')).rejects.toMatchObject({
      response: { error: 'SCORECARD_ALREADY_LOCKED' },
    });
  });

  it('rejects a stale confirmation with the exact concurrency message', async () => {
    const h = makeHarness();
    seedMatch(h.matches, { scorecardVersion: 5 });
    await expect(h.service.confirm(captain, 'm1', 4)).rejects.toMatchObject({
      response: { message: 'Scorecard got updated.' },
    });
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
    expect(row.state).toBe('SCORECARD_LOCKED');
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
    expect((h.matches.get('m2') as Row).state).toBe('SCORECARD_LOCKED');
  });
});

describe('ScorecardConfirmationService — Man of the Match (§13.3)', () => {
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

  it('rejects MoTM from a user who is not the winning captain', async () => {
    const h = makeHarness(decided('home'));
    seedMatch(h.matches);
    h.squadPlayers.push({ userId: 'p1', matchId: 'm1', teamId: 'home' });
    const outsider: AuthUser = { ...captain, id: 'other-1' };
    await expect(h.service.selectManOfMatch(outsider, 'm1', 'p1')).rejects.toMatchObject({
      response: { error: 'NOT_WINNING_CAPTAIN' },
    });
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
});
