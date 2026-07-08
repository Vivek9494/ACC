import { DismissalType, InningsType, type ScorecardResponse } from '@acc/types';

import {
  buildBoundaryLeaderboardEntries,
  createTournamentStatsAccumulators,
  foldScorecardIntoTournamentStats,
  tournamentStatsHasScoring,
} from './tournament-stats.compute';

function minimalScorecard(
  batters: ScorecardResponse['innings'][number]['batters'],
  bowlers: ScorecardResponse['innings'][number]['bowlers'],
  runs: number,
  wickets: number,
): ScorecardResponse {
  return {
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
        battingTeamId: 't1',
        bowlingTeamId: 't2',
        runs,
        wickets,
        legalBalls: 120,
        oversText: '20.0',
        oversAllotted: 20,
        extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalties: 0, total: 0 },
        batters,
        bowlers,
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
    ],
    result: {
      decided: true,
      isTie: false,
      isNoResult: false,
      winningTeamId: 't1',
      marginRuns: 10,
      marginWickets: null,
      superOverRequired: false,
      note: null,
    },
    display: { players: {}, innings: [] },
  };
}

describe('tournament-stats.compute', () => {
  it('aggregates runs, wickets, boundaries, milestones, and fifers', () => {
    const acc = createTournamentStatsAccumulators();
    const membership = new Set(['p1', 'p2']);

    foldScorecardIntoTournamentStats(
      acc,
      minimalScorecard(
        [
          {
            playerId: 'p1',
            runs: 105,
            balls: 60,
            ones: 0,
            twos: 0,
            threes: 0,
            fours: 8,
            sixes: 4,
            strikeRate: 175,
            isOut: false,
            dismissalType: null,
            bowlerId: null,
            fielderId: null,
            fielder2Id: null,
            retiredHurt: false,
            isMankad: false,
          },
          {
            playerId: 'p2',
            runs: 55,
            balls: 40,
            ones: 0,
            twos: 0,
            threes: 0,
            fours: 3,
            sixes: 1,
            strikeRate: 137.5,
            isOut: true,
            dismissalType: DismissalType.Caught,
            bowlerId: null,
            fielderId: null,
            fielder2Id: null,
            retiredHurt: false,
            isMankad: false,
          },
        ],
        [
          {
            playerId: 'p3',
            legalBalls: 24,
            oversText: '4.0',
            runsConceded: 30,
            wickets: 5,
            maidens: 0,
            dotBalls: 0,
            wides: 0,
            noBalls: 0,
            fours: 0,
            sixes: 0,
            economy: 7.5,
          },
        ],
        180,
        4,
      ),
      membership,
    );

    expect(acc.totalRuns).toBe(180);
    expect(acc.totalWickets).toBe(4);
    expect(acc.fours).toBe(11);
    expect(acc.sixes).toBe(5);
    expect(acc.hundreds).toBe(1);
    expect(acc.fifties).toBe(1);
    expect(acc.fifers).toBe(1);
    expect(acc.playerSixes.get('p1')).toBe(4);
    expect(acc.playerFours.get('p2')).toBe(3);
    expect(tournamentStatsHasScoring(acc)).toBe(true);
  });

  it('ranks boundary leaders with tie-break by name', () => {
    const entries = buildBoundaryLeaderboardEntries([
      {
        userId: 'u1',
        firstName: 'Zed',
        lastName: 'Alpha',
        profilePhotoUrl: null,
        teamId: 't1',
        teamName: 'Team A',
        count: 6,
      },
      {
        userId: 'u2',
        firstName: 'Amy',
        lastName: 'Beta',
        profilePhotoUrl: null,
        teamId: 't2',
        teamName: 'Team B',
        count: 8,
      },
      {
        userId: 'u3',
        firstName: 'Bob',
        lastName: 'Alpha',
        profilePhotoUrl: null,
        teamId: 't1',
        teamName: 'Team A',
        count: 6,
      },
    ]);

    expect(entries.map((entry) => entry.userId)).toEqual(['u2', 'u3', 'u1']);
    expect(entries[1]?.rank).toBe(2);
  });
});
