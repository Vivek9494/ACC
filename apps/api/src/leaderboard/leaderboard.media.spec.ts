import type { TournamentLeaderboard, TournamentStatsView } from '@acc/types';

import type { PrismaService } from '../prisma/prisma.service';
import type { ScorecardReader } from '../scoring/scorecard-reader';
import type { TournamentAggregatesCacheService } from '../stats/tournament-aggregates-cache.service';
import type { S3StorageService } from '../storage/s3-storage.service';
import { MediaUrlResolver } from '../storage/media-url.resolver';
import type { TennisTournamentVisibilityService } from '../tournaments/tennis-tournament-visibility.service';
import { LeaderboardService } from './leaderboard.service';

const LOGO_KEY = 'team-logos/t1/logo.jpg';

function entry(userId: string, teamId: string, teamLogoUrl: string | null) {
  return {
    rank: 1,
    userId,
    firstName: 'A',
    lastName: 'B',
    profilePhotoUrl: null,
    teamId,
    teamName: teamId,
    teamLogoUrl,
  };
}

function buildService(cached: { leaderboard?: TournamentLeaderboard; stats?: TournamentStatsView }) {
  const presign = jest.fn(async (key: string) => `https://signed.example/${key}`);
  const storage = { createPresignedReadUrl: presign } as Pick<S3StorageService, 'createPresignedReadUrl'>;
  const prisma = {
    tournament: { findUnique: jest.fn().mockResolvedValue({ id: 'tour', isDeleted: false }) },
  } as unknown as PrismaService;
  const visibility = {
    assertCanViewCenterLevelTournament: jest.fn().mockResolvedValue(undefined),
  } as unknown as TennisTournamentVisibilityService;
  const getTournamentStats = jest.fn().mockResolvedValue(cached.stats ?? null);
  const cache = {
    getLeaderboard: jest.fn().mockResolvedValue(cached.leaderboard ?? null),
    getTournamentStats,
  } as unknown as TournamentAggregatesCacheService;
  const service = new LeaderboardService(
    prisma,
    {} as ScorecardReader,
    new MediaUrlResolver(storage as S3StorageService),
    visibility,
    cache,
  );
  return { service, presign, getTournamentStats };
}

describe('LeaderboardService team logo URLs', () => {
  it('presigns stored team logo keys on leaderboard entries and team options', async () => {
    const { service, presign } = buildService({
      leaderboard: {
        tournamentId: 'tour',
        hasRecords: true,
        teams: [
          { id: 't1', name: 'Hornets', logoUrl: LOGO_KEY },
          { id: 't2', name: 'Fury', logoUrl: null },
        ],
        batting: {
          entries: [
            { ...entry('u1', 't1', LOGO_KEY), matches: 1, runs: 10, balls: 8, thirties: 0, fifties: 0, average: null, strikeRate: null },
            { ...entry('u2', 't2', null), matches: 1, runs: 5, balls: 8, thirties: 0, fifties: 0, average: null, strikeRate: null },
          ],
        },
        bowling: {
          entries: [
            { ...entry('u1', 't1', LOGO_KEY), matches: 1, innings: 1, wickets: 2, legalBalls: 12, bestBowling: '2/10', economy: 6 },
          ],
        },
      },
    });

    const board = await service.getLeaderboard('tour');

    const signed = `https://signed.example/${LOGO_KEY}`;
    expect(board.teams.map((t) => t.logoUrl)).toEqual([signed, null]);
    expect(board.batting.entries.map((e) => e.teamLogoUrl)).toEqual([signed, null]);
    expect(board.bowling.entries[0]?.teamLogoUrl).toBe(signed);
    expect(presign).toHaveBeenCalledTimes(1);
  });

  it('presigns team logos on tournament stats teams and boundary leaders', async () => {
    const { service, presign } = buildService({
      stats: {
        tournamentId: 'tour',
        hasRecords: true,
        teams: [
          { id: 't1', name: 'Hornets', logoUrl: LOGO_KEY },
          { id: 't2', name: 'Fury', logoUrl: null },
        ],
        aggregates: { totalRuns: 0, totalWickets: 0, sixes: 0, fours: 0, fifties: 0, hundreds: 0, fifers: 0 },
        mostSixes: [
          { ...entry('u1', 't1', LOGO_KEY), count: 3 },
          { ...entry('u2', 't2', null), count: 1 },
        ],
        mostFours: [{ ...entry('u1', 't1', LOGO_KEY), count: 5 }],
      },
    });

    const stats = await service.getTournamentStats('tour');

    const signed = `https://signed.example/${LOGO_KEY}`;
    expect(stats.teams.map((t) => t.logoUrl)).toEqual([signed, null]);
    expect(stats.mostSixes.map((e) => e.teamLogoUrl)).toEqual([signed, null]);
    expect(stats.mostFours[0]?.teamLogoUrl).toBe(signed);
    expect(presign).toHaveBeenCalledTimes(1);
  });

  it('falls back to the team list logo for boundary entries cached without one', async () => {
    const { rank, userId, firstName, lastName, profilePhotoUrl, teamId, teamName } = entry('u1', 't1', null);
    const { service, getTournamentStats } = buildService({});
    const legacyEntry = { rank, userId, firstName, lastName, profilePhotoUrl, teamId, teamName, count: 2 };
    getTournamentStats.mockResolvedValue({
      tournamentId: 'tour',
      hasRecords: true,
      teams: [{ id: 't1', name: 'Hornets', logoUrl: LOGO_KEY }],
      aggregates: { totalRuns: 0, totalWickets: 0, sixes: 0, fours: 0, fifties: 0, hundreds: 0, fifers: 0 },
      mostSixes: [legacyEntry],
      mostFours: [],
    });

    const stats = await service.getTournamentStats('tour');

    expect(stats.mostSixes[0]?.teamLogoUrl).toBe(`https://signed.example/${LOGO_KEY}`);
  });
});
