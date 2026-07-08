import 'reflect-metadata';

import { MatchState } from '@acc/types';

import { ScorerDashboardMatchService } from './scorer-dashboard-match.service';

function grantRow(
  overrides: Partial<{
    state: string;
    inningsCount: number;
    matchDate: Date;
    startTime: Date;
    squads: {
      teamId: string;
      isFinalized: boolean;
      players: { role: string }[];
    }[];
  }> = {},
) {
  const now = new Date();
  return {
    match: {
      id: 'match-1',
      state: overrides.state ?? MatchState.Live,
      matchDate: overrides.matchDate ?? now,
      startTime: overrides.startTime ?? now,
      externalOpponentName: null,
      homeTeamId: 'h1',
      awayTeamId: 'a1',
      homeTeam: { id: 'h1', name: 'Home', logoUrl: null },
      awayTeam: { id: 'a1', name: 'Away', logoUrl: null },
      tournament: { name: 'Test Cup', timezone: 'America/Toronto' },
      _count: { innings: overrides.inningsCount ?? 1 },
      squads: overrides.squads ?? [
        {
          teamId: 'h1',
          isFinalized: true,
          players: Array.from({ length: 11 }, () => ({ role: 'PLAYING_XI' })),
        },
        {
          teamId: 'a1',
          isFinalized: true,
          players: Array.from({ length: 11 }, () => ({ role: 'PLAYING_XI' })),
        },
      ],
    },
  };
}

describe('ScorerDashboardMatchService', () => {
  function buildService(): {
    service: ScorerDashboardMatchService;
    prisma: { matchScorerGrant: { findMany: jest.Mock } };
    mediaUrls: { resolveReadUrls: jest.Mock };
  } {
    const prisma = {
      matchScorerGrant: { findMany: jest.fn() },
    };
    const mediaUrls = {
      resolveReadUrls: jest.fn().mockResolvedValue([null, null]),
    };
    const service = new ScorerDashboardMatchService(
      prisma as never,
      mediaUrls as never,
    );
    return { service, prisma, mediaUrls };
  }

  it('returns hasScoringSession false for LIVE without innings (Start Match recovery)', async () => {
    const { service, prisma } = buildService();
    prisma.matchScorerGrant.findMany.mockResolvedValue([
      grantRow({ state: MatchState.Live, inningsCount: 0 }),
    ]);

    const result = await service.loadStartableMatch('scorer-1');

    expect(result).not.toBeNull();
    expect(result?.state).toBe(MatchState.Live);
    expect(result?.hasScoringSession).toBe(false);
  });

  it('returns hasScoringSession true for LIVE with innings (Continue Scoring)', async () => {
    const { service, prisma } = buildService();
    prisma.matchScorerGrant.findMany.mockResolvedValue([
      grantRow({ state: MatchState.Live, inningsCount: 1 }),
    ]);

    const result = await service.loadStartableMatch('scorer-1');

    expect(result).not.toBeNull();
    expect(result?.hasScoringSession).toBe(true);
  });

  it('returns bothTeamsFinalized when squads are finalized', async () => {
    const { service, prisma } = buildService();
    prisma.matchScorerGrant.findMany.mockResolvedValue([
      grantRow({ state: MatchState.Scheduled, inningsCount: 0 }),
    ]);

    const result = await service.loadStartableMatch('scorer-1');

    expect(result?.bothTeamsFinalized).toBe(true);
    expect(result?.homeTeamFinalized).toBe(true);
    expect(result?.awayTeamFinalized).toBe(true);
    expect(result?.canStartMatch).toBe(true);
    expect(result?.startMatchBlockedReason).toBeNull();
  });

  it('returns Verify Playing 11 when neither squad is finalized', async () => {
    const { service, prisma } = buildService();
    prisma.matchScorerGrant.findMany.mockResolvedValue([
      grantRow({
        state: MatchState.Scheduled,
        inningsCount: 0,
        squads: [
          { teamId: 'h1', isFinalized: false, players: [] },
          { teamId: 'a1', isFinalized: false, players: [] },
        ],
      }),
    ]);

    const result = await service.loadStartableMatch('scorer-1');

    expect(result?.bothTeamsFinalized).toBe(false);
  });
});
