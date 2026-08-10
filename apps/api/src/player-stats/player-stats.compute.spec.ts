import {
  DismissalType,
  InningsCloseReason,
  InningsType,
  formatPlayerProfileBestBowling,
  formatPlayerProfileHighestScore,
  type ScorecardResponse,
} from '@acc/types';

import {
  applyMatchToPlayerStats,
  buildPlayerProfileCareerStats,
  buildPlayerProfilePeriodStats,
  createPlayerStatsAccumulator,
  type PlayerMatchStatsContext,
} from './player-stats.compute';

const emptyScorecard = {
  matchId: 'match-1',
  version: 1,
  originalTarget: null,
  dlsTarget: null,
  effectiveTarget: null,
  innings: [],
  result: {
    decided: true,
    isTie: false,
    isNoResult: false,
    winningTeamId: null,
    marginRuns: null,
    marginWickets: null,
    superOverRequired: false,
    note: null,
  },
  display: { players: {}, innings: [] },
};

describe('player-stats.compute', () => {
  const context: PlayerMatchStatsContext = {
    matchId: 'match-1',
    matchDate: new Date('2024-06-15T12:00:00.000Z'),
    opponentName: 'ACC 9',
    groundLocation: 'Surat Ground',
    year: 2024,
  };

  it('accumulates batting, bowling, fielding, and locked-XI match count', () => {
    const acc = createPlayerStatsAccumulator();
    applyMatchToPlayerStats(acc, 'player-1', context, {
      ...emptyScorecard,
      innings: [
        {
          inningsId: 'inn-1',
          sequence: 1,
          inningsType: InningsType.Normal,
          battingTeamId: 'team-a',
          bowlingTeamId: 'team-b',
          runs: 180,
          wickets: 5,
          legalBalls: 150,
          oversText: '25.0',
          oversAllotted: 25,
          extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalties: 0, total: 0 },
          batters: [
            {
              playerId: 'player-1',
              runs: 82,
              balls: 54,
              ones: 0,
              twos: 0,
              threes: 0,
              fours: 8,
              sixes: 3,
              strikeRate: 151.9,
              isOut: false,
              dismissalType: null,
              bowlerId: null,
              fielderId: null,
              fielder2Id: null,
              retiredHurt: false,
              isMankad: false,
            },
            {
              playerId: 'other',
              runs: 12,
              balls: 10,
              ones: 0,
              twos: 0,
              threes: 0,
              fours: 1,
              sixes: 0,
              strikeRate: 120,
              isOut: true,
              dismissalType: DismissalType.Caught,
              bowlerId: 'bowler-1',
              fielderId: 'player-1',
              fielder2Id: null,
              retiredHurt: false,
              isMankad: false,
            },
          ],
          bowlers: [
            {
              playerId: 'player-1',
              legalBalls: 30,
              oversText: '5.0',
              runsConceded: 24,
              wickets: 2,
              maidens: 0,
              dotBalls: 12,
              wides: 0,
              noBalls: 0,
              fours: 2,
              sixes: 1,
              economy: 4.8,
            },
          ],
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
          closeReason: InningsCloseReason.AllOut,
          target: null,
          droppedCatches: [],
          droppedCatchEvents: [],
        },
      ],
    });

    expect(acc.lockedXiMatchIds).toEqual(new Set(['match-1']));
    expect(acc.runs).toBe(82);
    expect(acc.fours).toBe(8);
    expect(acc.sixes).toBe(3);
    expect(acc.wickets).toBe(2);
    expect(acc.catches).toBe(1);
    expect(acc.highestScore).toEqual({
      runs: 82,
      notOut: true,
      opponent: 'ACC 9',
      venue: 'Surat Ground',
      year: 2024,
    });

    const period = buildPlayerProfilePeriodStats(acc);
    expect(period.matches).toBe(1);
    expect(period.highestScore).toBe(formatPlayerProfileHighestScore(82, true));
    expect(period.bestBowling).toBe(formatPlayerProfileBestBowling(2, 24));
    expect(period.bowlingAverage).toBe(12);
    expect(period.economy).toBe(4.8);
    expect(period.highestScoreContext).toBe('Surat Ground, 2024');
    expect(period.bestBowlingContext).toBe('vs ACC 9, 2024');
    expect(period.droppedCatches).toBe(0);
  });

  it('accumulates dropped catches from innings metadata', () => {
    const acc = createPlayerStatsAccumulator();
    applyMatchToPlayerStats(acc, 'fielder-1', context, {
      ...emptyScorecard,
      innings: [
        {
          inningsId: 'inn-1',
          sequence: 1,
          inningsType: InningsType.Normal,
          battingTeamId: 'team-a',
          bowlingTeamId: 'team-b',
          runs: 10,
          wickets: 0,
          legalBalls: 6,
          oversText: '1.0',
          oversAllotted: 20,
          extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalties: 0, total: 0 },
          batters: [],
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
          closed: false,
          closeReason: null,
          target: null,
          droppedCatches: [
            { playerId: 'fielder-1', count: 2 },
            { playerId: 'other-fielder', count: 1 },
          ],
          droppedCatchEvents: [],
        },
      ],
    });

    expect(acc.droppedCatches).toBe(2);
    expect(buildPlayerProfilePeriodStats(acc).droppedCatches).toBe(2);
  });

  it('tracks stumpings and career span across years', () => {
    const acc = createPlayerStatsAccumulator();

    const stumpingContext: PlayerMatchStatsContext = {
      matchId: 'match-old',
      matchDate: new Date('2023-03-01T00:00:00.000Z'),
      opponentName: 'Team X',
      groundLocation: null,
      year: 2023,
    };
    const stumpingScorecard: ScorecardResponse = {
      ...emptyScorecard,
      innings: [
        {
          inningsId: 'inn-1',
          sequence: 1,
          inningsType: InningsType.Normal,
          battingTeamId: null,
          bowlingTeamId: null,
          runs: 0,
          wickets: 1,
          legalBalls: 6,
          oversText: '1.0',
          oversAllotted: 25,
          extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalties: 0, total: 0 },
          batters: [
            {
              playerId: 'other',
              runs: 0,
              balls: 1,
              ones: 0,
              twos: 0,
              threes: 0,
              fours: 0,
              sixes: 0,
              strikeRate: 0,
              isOut: true,
              dismissalType: DismissalType.Stumped,
              bowlerId: 'bowler',
              fielderId: 'keeper-1',
              fielder2Id: null,
              retiredHurt: false,
              isMankad: false,
            },
          ],
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
          closeReason: InningsCloseReason.AllOut,
          target: null,
          droppedCatches: [],
          droppedCatchEvents: [],
        },
      ],
    };

    applyMatchToPlayerStats(acc, 'keeper-1', stumpingContext, stumpingScorecard);

    const laterContext: PlayerMatchStatsContext = {
      matchId: 'match-new',
      matchDate: new Date('2024-08-01T00:00:00.000Z'),
      opponentName: 'Team Y',
      groundLocation: null,
      year: 2024,
    };
    applyMatchToPlayerStats(acc, 'keeper-1', laterContext, emptyScorecard);

    const career = buildPlayerProfileCareerStats(acc);

    expect(career.stumpings).toBe(1);
    expect(career.careerSpanYears).toBe(1);
  });
});
