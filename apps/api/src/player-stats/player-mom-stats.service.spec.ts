import {
  BallType,
  InningsType,
  buildPlayerMomMatchFigures,
  type OwnPlayerMomMatchesView,
  type ScorecardResponse,
} from '@acc/types';

import { PlayerMomStatsService } from './player-mom-stats.service';

describe('PlayerMomStatsService', () => {
  const userId = 'player-1';

  const scorecard = {
    matchId: 'm1',
    version: 1,
    originalTarget: null,
    dlsTarget: null,
    effectiveTarget: null,
    innings: [
      {
        inningsId: 'i1',
        sequence: 1,
        inningsType: InningsType.Normal,
        battingTeamId: 'home',
        bowlingTeamId: 'away',
        bowlingIsExternal: false,
        runs: 120,
        wickets: 3,
        closed: true,
        batters: [
          {
            playerId: userId,
            runs: 42,
            balls: 28,
            ones: 10,
            twos: 2,
            threes: 0,
            fours: 3,
            sixes: 1,
            strikeRate: 150,
            isOut: false,
            dismissalType: null,
            bowlerId: null,
            fielderId: null,
            fielder2Id: null,
            retiredHurt: false,
            isMankad: false,
          },
        ],
        bowlers: [
          {
            playerId: userId,
            legalBalls: 24,
            oversText: '4.0',
            runsConceded: 24,
            wickets: 2,
            maidens: 0,
            dotBalls: 8,
            wides: 0,
            noBalls: 0,
            fours: 2,
            sixes: 0,
            economy: 6,
          },
        ],
        droppedCatchEvents: [],
        fallOfWickets: [],
        partnerships: [],
      },
    ],
    result: {
      decided: true,
      isTie: false,
      isNoResult: false,
      winningTeamId: 'home',
      marginRuns: 10,
      marginWickets: null,
      superOverRequired: false,
      note: null,
    },
    display: { innings: [] },
  } as unknown as ScorecardResponse;

  function makeService(rows: Array<Record<string, unknown>>) {
    const prisma = {
      match: {
        findMany: jest.fn().mockResolvedValue(rows),
      },
    };
    const scorecards = {
      byMatchId: jest.fn().mockResolvedValue(scorecard),
    };
    return {
      service: new PlayerMomStatsService(prisma as never, scorecards as never),
      scorecards,
    };
  }

  it('returns zero summary when the user has no MoM awards', async () => {
    const { service } = makeService([]);
    await expect(service.buildSummary(userId, BallType.Leather)).resolves.toEqual({
      count: 0,
      mostRecent: null,
    });
  });

  it('returns count and most recent figures from the scorecard', async () => {
    const row = {
      id: 'm1',
      matchDate: new Date('2026-06-15T00:00:00.000Z'),
      resultNote: 'ACC 3 won by 10 runs',
      manOfTheMatchSelectedAt: new Date('2026-06-15T20:00:00.000Z'),
      completedAt: new Date('2026-06-15T18:00:00.000Z'),
      externalOpponentName: null,
      homeTeam: { name: 'ACC 3' },
      awayTeam: { name: 'Rivals' },
      tournament: { id: 't1', name: 'ACC 2026' },
    };
    const { service } = makeService([row]);

    const summary = await service.buildSummary(userId, BallType.Leather);
    expect(summary.count).toBe(1);
    expect(summary.mostRecent).toMatchObject({
      matchId: 'm1',
      tournamentName: 'ACC 2026',
      homeTeamName: 'ACC 3',
      awayTeamName: 'Rivals',
      resultNote: 'ACC 3 won by 10 runs',
    });
    expect(summary.mostRecent?.figures).toEqual(buildPlayerMomMatchFigures(scorecard, userId));
  });

  it('lists all MoM matches newest first for the ball type', async () => {
    const rows = [
      {
        id: 'm2',
        matchDate: new Date('2026-07-01T00:00:00.000Z'),
        resultNote: null,
        manOfTheMatchSelectedAt: new Date('2026-07-01T22:00:00.000Z'),
        completedAt: new Date('2026-07-01T20:00:00.000Z'),
        externalOpponentName: null,
        homeTeam: { name: 'A' },
        awayTeam: { name: 'B' },
        tournament: { id: 't2', name: 'APL' },
      },
    ];
    const { service } = makeService(rows);

    const view: OwnPlayerMomMatchesView = await service.listMatches(userId, BallType.Tennis);
    expect(view.ballType).toBe(BallType.Tennis);
    expect(view.count).toBe(1);
    expect(view.matches[0]?.matchId).toBe('m2');
  });
});
