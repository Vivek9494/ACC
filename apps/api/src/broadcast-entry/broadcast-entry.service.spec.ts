import 'reflect-metadata';

import {
  BroadcastEntryAccess,
  BroadcastEntryMatchStatus,
  formatBroadcastEntryMatchLabel,
  MatchState,
  ScoringMode,
  UserRole,
  type AuthUser,
} from '@acc/types';
import { ForbiddenException } from '@nestjs/common';

import type { PrismaService } from '../prisma/prisma.service';
import { BroadcastEntryService } from './broadcast-entry.service';

const NOW = new Date('2026-09-28T16:00:00.000Z');

interface TournamentRow {
  id: string;
  name: string;
  ballType: string;
  startAt: Date;
  endAt: Date;
  timezone: string | null;
  isDeleted: boolean;
}

interface MatchRow {
  id: string;
  tournamentId: string;
  state: string;
  scoringMode: string;
  isDeleted: boolean;
  matchDate: Date | null;
  startTime: Date | null;
  externalOpponentName: string | null;
  homeTeam: { name: string } | null;
  awayTeam: { name: string } | null;
}

const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

const TOURNAMENTS: TournamentRow[] = [
  { id: 't-apl', name: 'APL 2026', ballType: 'TENNIS', startAt: day('2026-09-20'), endAt: day('2026-10-05'), timezone: 'America/Toronto', isDeleted: false },
  { id: 't-acc', name: 'ACC League', ballType: 'LEATHER', startAt: day('2026-09-01'), endAt: day('2026-10-30'), timezone: 'America/Toronto', isDeleted: false },
  { id: 't-center', name: 'Center Cup', ballType: 'TENNIS', startAt: day('2026-09-25'), endAt: day('2026-09-29'), timezone: 'America/Toronto', isDeleted: false },
  { id: 't-future', name: 'Winter Cup', ballType: 'TENNIS', startAt: day('2026-12-01'), endAt: day('2026-12-10'), timezone: 'America/Toronto', isDeleted: false },
  { id: 't-done', name: 'Summer Cup', ballType: 'TENNIS', startAt: day('2026-07-01'), endAt: day('2026-07-10'), timezone: 'America/Toronto', isDeleted: false },
  { id: 't-deleted', name: 'Deleted Cup', ballType: 'TENNIS', startAt: day('2026-09-01'), endAt: day('2026-10-30'), timezone: null, isDeleted: true },
];

const match = (overrides: Partial<MatchRow> & Pick<MatchRow, 'id'>): MatchRow => ({
  tournamentId: 't-apl',
  state: MatchState.Scheduled,
  scoringMode: ScoringMode.Live,
  isDeleted: false,
  matchDate: day('2026-09-30'),
  startTime: null,
  externalOpponentName: null,
  homeTeam: { name: 'Lions' },
  awayTeam: { name: 'Tigers' },
  ...overrides,
});

const MATCHES: MatchRow[] = [
  match({ id: 'm-oct2', matchDate: day('2026-10-02'), startTime: new Date('2026-10-02T14:00:00.000Z') }),
  match({ id: 'm-live', state: MatchState.Live, matchDate: day('2026-09-28'), homeTeam: { name: 'Hawks' }, awayTeam: { name: 'Eagles' } }),
  match({ id: 'm-sep29', state: MatchState.PlayingXiLocked, matchDate: day('2026-09-29'), startTime: new Date('2026-09-29T22:00:00.000Z') }),
  match({ id: 'm-rain', state: MatchState.RainInterrupted, matchDate: day('2026-09-27') }),
  match({ id: 'm-done', state: MatchState.Completed }),
  match({ id: 'm-cancelled', state: MatchState.Cancelled }),
  match({ id: 'm-backfill', scoringMode: ScoringMode.ScorecardOnly }),
  match({ id: 'm-deleted', isDeleted: true }),
  match({ id: 'm-acc', tournamentId: 't-acc', homeTeam: { name: 'ACC 3' }, awayTeam: null, externalOpponentName: 'Brampton CC' }),
];

function makePrisma(assignments: {
  pool?: { userId: string; tournamentId: string }[];
  grants?: { userId: string; matchId: string; tournamentId: string; revoked?: boolean; matchDeleted?: boolean }[];
}) {
  const pool = assignments.pool ?? [];
  const grants = assignments.grants ?? [];
  return {
    tournament: {
      findMany: jest.fn(async (args: { where: { isDeleted: boolean; id?: { in: string[] } } }) =>
        TOURNAMENTS.filter(
          (t) =>
            t.isDeleted === args.where.isDeleted &&
            (args.where.id ? args.where.id.in.includes(t.id) : true),
        ).sort((a, b) => a.name.localeCompare(b.name)),
      ),
    },
    tournamentScorer: {
      findMany: jest.fn(async (args: { where: { userId: string } }) =>
        pool.filter((p) => p.userId === args.where.userId).map((p) => ({ tournamentId: p.tournamentId })),
      ),
    },
    matchScorerGrant: {
      findMany: jest.fn(
        async (args: { where: { userId: string; revokedAt: null; match: { isDeleted: boolean } } }) =>
          grants
            .filter(
              (g) =>
                g.userId === args.where.userId &&
                !g.revoked &&
                (g.matchDeleted ?? false) === args.where.match.isDeleted,
            )
            .map((g) => ({ match: { tournamentId: g.tournamentId } })),
      ),
    },
    match: {
      findMany: jest.fn(
        async (args: {
          where: {
            isDeleted: boolean;
            tournamentId: string;
            scoringMode: string;
            state: { in: string[] };
          };
        }) =>
          MATCHES.filter(
            (m) =>
              m.isDeleted === args.where.isDeleted &&
              m.tournamentId === args.where.tournamentId &&
              m.scoringMode === args.where.scoringMode &&
              args.where.state.in.includes(m.state),
          ).map((m) => ({ ...m, tournament: { timezone: 'America/Toronto' } })),
      ),
    },
  };
}

function user(role: UserRole, id = `u-${role}`): AuthUser {
  return {
    id,
    firstName: 'Test',
    lastName: 'User',
    mobileNumber: '+15555550100',
    email: 'test@acc.local',
    centerId: 'center-1',
    jerseyNumber: 7,
    profilePhotoUrl: null,
    role,
    isActive: true,
  };
}

function service(prisma: ReturnType<typeof makePrisma>): BroadcastEntryService {
  return new BroadcastEntryService(prisma as never as PrismaService);
}

describe('BroadcastEntryService.listTournaments', () => {
  it.each([UserRole.Admin, UserRole.ClubManager])(
    '%s sees ALL date-Live tournaments without scorer scoping',
    async (role) => {
      const prisma = makePrisma({});
      const result = await service(prisma).listTournaments(user(role), NOW);
      expect(result.access).toBe(BroadcastEntryAccess.All);
      expect(result.tournaments.map((t) => t.id)).toEqual(['t-acc', 't-apl', 't-center']);
      expect(prisma.tournamentScorer.findMany).not.toHaveBeenCalled();
      expect(prisma.matchScorerGrant.findMany).not.toHaveBeenCalled();
    },
  );

  it('scorer sees only assigned Live tournaments (tennis pool + leather match grant)', async () => {
    const prisma = makePrisma({
      pool: [
        { userId: 'scorer', tournamentId: 't-apl' },
        { userId: 'scorer', tournamentId: 't-future' },
        { userId: 'scorer', tournamentId: 't-done' },
        { userId: 'other', tournamentId: 't-center' },
      ],
      grants: [{ userId: 'scorer', matchId: 'm-acc', tournamentId: 't-acc' }],
    });
    const result = await service(prisma).listTournaments(user(UserRole.Player, 'scorer'), NOW);
    expect(result.access).toBe(BroadcastEntryAccess.Scorer);
    expect(result.tournaments.map((t) => t.id)).toEqual(['t-acc', 't-apl']);
  });

  it('scorer assigned to exactly one Live tournament gets one entry', async () => {
    const prisma = makePrisma({ pool: [{ userId: 'scorer', tournamentId: 't-center' }] });
    const result = await service(prisma).listTournaments(user(UserRole.Player, 'scorer'), NOW);
    expect(result.tournaments).toEqual([{ id: 't-center', name: 'Center Cup', ballType: 'TENNIS' }]);
  });

  it('revoked grants, deleted matches and deleted tournaments do not count', async () => {
    const prisma = makePrisma({
      pool: [{ userId: 'scorer', tournamentId: 't-deleted' }],
      grants: [
        { userId: 'scorer', matchId: 'm-acc', tournamentId: 't-acc', revoked: true },
        { userId: 'scorer', matchId: 'm-x', tournamentId: 't-apl', matchDeleted: true },
      ],
    });
    const result = await service(prisma).listTournaments(user(UserRole.Player, 'scorer'), NOW);
    expect(result.tournaments).toEqual([]);
  });

  it('a user with no assignment (Center Sevak, Captain, Player) gets no tournaments', async () => {
    for (const role of [UserRole.CenterSevak, UserRole.Captain, UserRole.Player]) {
      const prisma = makePrisma({});
      const result = await service(prisma).listTournaments(user(role), NOW);
      expect(result).toEqual({ access: BroadcastEntryAccess.Scorer, tournaments: [] });
      expect(prisma.tournament.findMany).not.toHaveBeenCalled();
    }
  });
});

describe('BroadcastEntryService.listMatches', () => {
  it('returns Live first, then all upcoming by soonest date; excludes ended / backfill / deleted', async () => {
    const matches = await service(makePrisma({})).listMatches(user(UserRole.Admin), 't-apl', NOW);
    expect(matches.map((m) => [m.id, m.status])).toEqual([
      ['m-rain', BroadcastEntryMatchStatus.Live],
      ['m-live', BroadcastEntryMatchStatus.Live],
      ['m-sep29', BroadcastEntryMatchStatus.Upcoming],
      ['m-oct2', BroadcastEntryMatchStatus.Upcoming],
    ]);
  });

  it('uses the external opponent name for ACC fixtures', async () => {
    const matches = await service(makePrisma({})).listMatches(user(UserRole.ClubManager), 't-acc', NOW);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ teamAName: 'ACC 3', teamBName: 'Brampton CC' });
  });

  it('scorer can list matches of an assigned tournament', async () => {
    const prisma = makePrisma({ pool: [{ userId: 'scorer', tournamentId: 't-apl' }] });
    const matches = await service(prisma).listMatches(user(UserRole.Player, 'scorer'), 't-apl', NOW);
    expect(matches).toHaveLength(4);
  });

  it('scorer is forbidden on a tournament they are not assigned to', async () => {
    const prisma = makePrisma({ pool: [{ userId: 'scorer', tournamentId: 't-apl' }] });
    await expect(
      service(prisma).listMatches(user(UserRole.Player, 'scorer'), 't-center', NOW),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.match.findMany).not.toHaveBeenCalled();
  });

  it('unassigned users are forbidden; Admin is forbidden only on non-Live tournaments', async () => {
    await expect(
      service(makePrisma({})).listMatches(user(UserRole.Player), 't-apl', NOW),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service(makePrisma({})).listMatches(user(UserRole.Admin), 't-future', NOW),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('formatBroadcastEntryMatchLabel', () => {
  it('formats "X vs Y | Month Date | Live/Upcoming" in the venue timezone', () => {
    expect(
      formatBroadcastEntryMatchLabel({
        id: 'a',
        teamAName: 'Lions',
        teamBName: 'Tigers',
        matchDate: '2026-09-29T00:00:00.000Z',
        // 22:00 UTC on Sep 29 is still Sep 29 in Toronto.
        startTime: '2026-09-29T22:00:00.000Z',
        timezone: 'America/Toronto',
        status: BroadcastEntryMatchStatus.Upcoming,
      }),
    ).toBe('Lions vs Tigers | Sep 29 | Upcoming');
    expect(
      formatBroadcastEntryMatchLabel({
        id: 'b',
        teamAName: 'Hawks',
        teamBName: 'Eagles',
        matchDate: '2026-09-28T00:00:00.000Z',
        startTime: null,
        timezone: 'America/Toronto',
        status: BroadcastEntryMatchStatus.Live,
      }),
    ).toBe('Hawks vs Eagles | Sep 28 | Live');
  });

  it('shows Date TBD when the fixture has no schedule', () => {
    expect(
      formatBroadcastEntryMatchLabel({
        id: 'c',
        teamAName: 'A',
        teamBName: 'B',
        matchDate: null,
        startTime: null,
        timezone: null,
        status: BroadcastEntryMatchStatus.Upcoming,
      }),
    ).toBe('A vs B | Date TBD | Upcoming');
  });
});
