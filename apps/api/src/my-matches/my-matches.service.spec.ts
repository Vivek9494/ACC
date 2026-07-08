import 'reflect-metadata';

import { MatchState } from '@acc/types';

import { myMatchesStateWhere } from '../matches/match-visibility.utils';
import { PrismaService } from '../prisma/prisma.service';
import { ScorecardReader } from '../scoring/scorecard-reader';
import { MediaUrlResolver } from '../storage/media-url.resolver';
import { MyMatchesService } from './my-matches.service';

describe('MyMatchesService', () => {
  let service: MyMatchesService;
  let prisma: {
    matchSquadPlayer: { findMany: jest.Mock };
    match: { findMany: jest.Mock };
  };
  let scorecardReader: { build: jest.Mock };
  let mediaUrls: { resolveReadUrls: jest.Mock };

  beforeEach(() => {
    prisma = {
      matchSquadPlayer: { findMany: jest.fn() },
      match: { findMany: jest.fn() },
    };
    scorecardReader = { build: jest.fn() };
    mediaUrls = {
      resolveReadUrls: jest.fn(async (values: (string | null)[]) => values),
    };

    service = new MyMatchesService(
      prisma as unknown as PrismaService,
      scorecardReader as unknown as ScorecardReader,
      mediaUrls as unknown as MediaUrlResolver,
    );
  });

  it('queries with scored-cancelled OR filter (delivery EXISTS, not N+1)', async () => {
    prisma.matchSquadPlayer.findMany.mockResolvedValue([
      { squad: { matchId: 'cancelled-scored' } },
      { squad: { matchId: 'cancelled-unscored' } },
      { squad: { matchId: 'nr-1' } },
    ]);
    prisma.match.findMany.mockResolvedValue([
      {
        id: 'cancelled-scored',
        state: MatchState.Cancelled,
        isNoResult: false,
        isDeleted: false,
        homeTeamId: 'team-a',
        awayTeamId: 'team-b',
        homeTeam: { id: 'team-a', name: 'Team A', logoUrl: null },
        awayTeam: { id: 'team-b', name: 'Team B', logoUrl: null },
        externalOpponentName: null,
        matchDate: new Date('2026-06-30T00:00:00.000Z'),
        startTime: new Date('2026-06-30T17:00:00.000Z'),
        delayMinutes: 0,
        completedAt: null,
        winningTeamId: null,
        resultNote: 'Rain',
        tournamentId: 't-1',
        tournament: {
          id: 't-1',
          name: 'APL',
          ballType: 'TENNIS',
          oversPerInnings: 20,
          timezone: 'America/Toronto',
        },
      },
      {
        id: 'nr-1',
        state: MatchState.NoResult,
        isNoResult: true,
        isDeleted: false,
        homeTeamId: 'team-a',
        awayTeamId: 'team-b',
        homeTeam: { id: 'team-a', name: 'Team A', logoUrl: null },
        awayTeam: { id: 'team-b', name: 'Team B', logoUrl: null },
        externalOpponentName: null,
        matchDate: new Date('2026-07-01T00:00:00.000Z'),
        startTime: new Date('2026-07-01T17:00:00.000Z'),
        delayMinutes: 0,
        completedAt: new Date('2026-07-01T21:00:00.000Z'),
        winningTeamId: null,
        resultNote: null,
        tournamentId: 't-1',
        tournament: {
          id: 't-1',
          name: 'APL',
          ballType: 'TENNIS',
          oversPerInnings: 20,
          timezone: 'America/Toronto',
        },
      },
    ]);
    scorecardReader.build.mockRejectedValue(new Error('no scorecard'));

    const result = await service.listForUser('player-1');

    expect(prisma.match.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ['cancelled-scored', 'cancelled-unscored', 'nr-1'] },
          ...myMatchesStateWhere,
        }),
      }),
    );
    expect(result.matches).toHaveLength(2);
    expect(result.matches.map((match) => match.id)).toEqual(
      expect.arrayContaining(['cancelled-scored', 'nr-1']),
    );
    expect(result.matches.find((match) => match.id === 'cancelled-scored')?.displayState).toBe(
      'CANCELLED',
    );
    expect(result.matches.find((match) => match.id === 'cancelled-scored')?.footerLine).toBeNull();
  });

  it('does not fall back to team roster for scheduled fixtures without a posted Playing 11', async () => {
    prisma.matchSquadPlayer.findMany.mockResolvedValue([]);

    const result = await service.listForUser('player-1');

    expect(prisma.match.findMany).not.toHaveBeenCalled();
    expect(result.matches).toEqual([]);
  });
});
