import {
  DismissalType,
  InningsCloseReason,
  InningsType,
  LEATHER_STANDINGS_POINTS,
  parseOversTextToLegalBalls,
  type BatterCard,
  type BowlerCard,
  type StandingsMatchInput,
} from '@acc/types';

import {
  applyBatterInnings,
  applyBowlerInnings,
  createBattingAccumulator,
  createBowlingAccumulator,
} from '../leaderboard/leaderboard.compute';
import {
  createTournamentStatsAccumulators,
  foldScorecardIntoTournamentStats,
} from '../leaderboard/tournament-stats.compute';
import {
  applyMatchToPlayerStats,
  createPlayerStatsAccumulator,
} from '../player-stats/player-stats.compute';
import { computeStandings } from '../standings/standings.compute';
import { wasInningsAllOut } from '../standings/standings.nrr';
import { deriveMatchResult } from './engine';
import {
  buildInningsScorecardFromSummary,
  mergeScorecardOnlyResult,
  type ScorecardSummaryInningsInput,
} from './scorecard-summary.builder';

/**
 * Sample-shaped scorecard (leather-style totals):
 * Team A 96/7 in 21.2 — Team B 101/2 in 16.2 (B wins).
 * Figures abbreviated from a real historical card for Phase 1 validation.
 */
const TEAM_A = 'team-atmiya-3';
const TEAM_B = 'team-royal-tigers';

const BATTER_A1 = 'player-a-opener';
const BATTER_A2 = 'player-a-two';
const BATTER_A3 = 'player-a-three';
const BATTER_B1 = 'player-b-opener';
const BATTER_B2 = 'player-b-two';
const BATTER_B3 = 'player-b-three';

const BOWLER_B1 = 'player-b-bowler-1';
const BOWLER_B2 = 'player-b-bowler-2';
const BOWLER_A1 = 'player-a-bowler-1';
const BOWLER_A2 = 'player-a-bowler-2';

function sampleInnings(): ScorecardSummaryInningsInput[] {
  return [
    {
      id: 'inn-1',
      sequence: 1,
      inningsType: InningsType.Normal,
      battingTeamId: TEAM_A,
      bowlingTeamId: TEAM_B,
      runs: 96,
      wickets: 7,
      legalBalls: parseOversTextToLegalBalls('21.2'),
      oversText: '21.2',
      oversAllotted: 25,
      closed: true,
      closeReason: InningsCloseReason.ManuallyEnded,
      extrasWides: 4,
      extrasNoBalls: 1,
      extrasByes: 2,
      extrasLegByes: 1,
      extrasPenalties: 0,
      extrasTotal: 8,
      batters: [
        {
          playerId: BATTER_A1,
          runs: 34,
          balls: 28,
          fours: 3,
          sixes: 1,
          isOut: true,
          dismissalType: DismissalType.Caught,
          bowlerId: BOWLER_B1,
          fielderId: BATTER_B2,
        },
        {
          playerId: BATTER_A2,
          runs: 22,
          balls: 19,
          fours: 2,
          sixes: 0,
          isOut: true,
          dismissalType: DismissalType.Bowled,
          bowlerId: BOWLER_B2,
        },
        {
          playerId: BATTER_A3,
          runs: 18,
          balls: 15,
          fours: 1,
          sixes: 1,
          isOut: false,
        },
      ],
      bowlers: [
        {
          playerId: BOWLER_B1,
          legalBalls: parseOversTextToLegalBalls('5.0'),
          maidens: 0,
          runsConceded: 28,
          wickets: 2,
        },
        {
          playerId: BOWLER_B2,
          legalBalls: parseOversTextToLegalBalls('4.2'),
          maidens: 1,
          runsConceded: 19,
          wickets: 3,
        },
      ],
      fallOfWickets: [
        { wicketNumber: 1, playerId: BATTER_A1, teamRuns: 40, oversText: '7.3' },
        { wicketNumber: 2, playerId: BATTER_A2, teamRuns: 61, oversText: '12.1' },
      ],
    },
    {
      id: 'inn-2',
      sequence: 2,
      inningsType: InningsType.Normal,
      battingTeamId: TEAM_B,
      bowlingTeamId: TEAM_A,
      runs: 101,
      wickets: 2,
      legalBalls: parseOversTextToLegalBalls('16.2'),
      oversText: '16.2',
      oversAllotted: 25,
      closed: true,
      closeReason: InningsCloseReason.TargetReached,
      target: 97,
      extrasWides: 3,
      extrasNoBalls: 0,
      extrasByes: 0,
      extrasLegByes: 1,
      extrasPenalties: 0,
      extrasTotal: 4,
      batters: [
        {
          playerId: BATTER_B1,
          runs: 45,
          balls: 40,
          fours: 4,
          sixes: 1,
          isOut: false,
        },
        {
          playerId: BATTER_B2,
          runs: 30,
          balls: 22,
          fours: 2,
          sixes: 2,
          isOut: true,
          dismissalType: DismissalType.Caught,
          bowlerId: BOWLER_A1,
          fielderId: BATTER_A3,
        },
        {
          playerId: BATTER_B3,
          runs: 12,
          balls: 10,
          fours: 1,
          sixes: 0,
          isOut: false,
        },
      ],
      bowlers: [
        {
          playerId: BOWLER_A1,
          legalBalls: parseOversTextToLegalBalls('5.0'),
          maidens: 0,
          runsConceded: 32,
          wickets: 1,
        },
        {
          playerId: BOWLER_A2,
          legalBalls: parseOversTextToLegalBalls('4.0'),
          maidens: 0,
          runsConceded: 24,
          wickets: 0,
        },
      ],
    },
  ];
}

describe('scorecard-summary.builder (Phase 1)', () => {
  const cards = sampleInnings().map(buildInningsScorecardFromSummary);
  const derived = deriveMatchResult(cards);
  const result = mergeScorecardOnlyResult(derived, {
    winningTeamId: TEAM_B,
    isNoResult: false,
    resultNote: 'Royal Tigers won by 8 wickets',
  });

  it('builds innings totals, extras, and empty ball-level collections', () => {
    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({
      runs: 96,
      wickets: 7,
      oversText: '21.2',
      legalBalls: 128,
      closed: true,
      timeline: [],
      recentOvers: [],
      partnerships: [],
      partnership: null,
      droppedCatches: [],
    });
    expect(cards[0]?.extras).toEqual({
      wides: 4,
      noBalls: 1,
      byes: 2,
      legByes: 1,
      penalties: 0,
      total: 8,
    });
    expect(cards[1]).toMatchObject({
      runs: 101,
      wickets: 2,
      oversText: '16.2',
      legalBalls: 98,
      target: 97,
      closeReason: InningsCloseReason.TargetReached,
    });
  });

  it('builds batter / bowler cards with recomputed SR and economy', () => {
    const opener = cards[0]?.batters[0] as BatterCard;
    expect(opener.runs).toBe(34);
    expect(opener.fours).toBe(3);
    expect(opener.sixes).toBe(1);
    expect(opener.strikeRate).toBe(121.43);
    expect(opener.dismissalType).toBe(DismissalType.Caught);
    expect(opener.fielderId).toBe(BATTER_B2);

    const strikeBowler = cards[0]?.bowlers[1] as BowlerCard;
    expect(strikeBowler.wickets).toBe(3);
    expect(strikeBowler.maidens).toBe(1);
    expect(strikeBowler.oversText).toBe('4.2');
    expect(strikeBowler.economy).toBeGreaterThan(0);
  });

  it('keeps optional FoW when present', () => {
    expect(cards[0]?.fallOfWickets).toEqual([
      { wicketNumber: 1, playerId: BATTER_A1, teamRuns: 40, oversText: '7.3' },
      { wicketNumber: 2, playerId: BATTER_A2, teamRuns: 61, oversText: '12.1' },
    ]);
    expect(cards[1]?.fallOfWickets).toEqual([]);
  });

  it('derives leather points path: winner gets 10, loser 0', () => {
    expect(result.winningTeamId).toBe(TEAM_B);
    expect(result.decided).toBe(true);

    const matchInputs: StandingsMatchInput[] = [
      {
        matchId: 'm-sample',
        groupId: null,
        homeTeamId: TEAM_A,
        awayTeamId: TEAM_B,
        isNoResult: false,
        winningTeamId: result.winningTeamId,
        isDecided: result.decided,
        requiresSuperOver: false,
        innings: cards.map((inn) => ({
          battingTeamId: inn.battingTeamId,
          bowlingTeamId: inn.bowlingTeamId,
          runs: inn.runs,
          legalBalls: inn.legalBalls,
          wasAllOut: wasInningsAllOut(inn.closeReason),
          oversAllotted: inn.oversAllotted,
        })),
      },
    ];

    const { tables } = computeStandings({
      tournamentId: 't-sample',
      matchSchedulingFormat: null,
      groupCount: 0,
      teams: [
        { teamId: TEAM_A, teamName: 'Atmiya 3', logoUrl: null, groupId: null },
        { teamId: TEAM_B, teamName: 'Royal Tigers', logoUrl: null, groupId: null },
      ],
      groups: [],
      matches: matchInputs,
      includeNetRunRate: false,
      points: LEATHER_STANDINGS_POINTS,
      awardUndecidedAsSplit: true,
    });

    const overall = tables[0]?.teams ?? [];
    const winner = overall.find((row) => row.teamId === TEAM_B);
    const loser = overall.find((row) => row.teamId === TEAM_A);
    expect(winner?.points).toBe(10);
    expect(loser?.points).toBe(0);
    expect(winner?.wins).toBe(1);
    expect(loser?.losses).toBe(1);
  });

  it('feeds leaderboard + tournament-stats + career accumulators', () => {
    const batting = new Map<string, ReturnType<typeof createBattingAccumulator>>();
    const bowling = new Map<string, ReturnType<typeof createBowlingAccumulator>>();
    const statsAcc = createTournamentStatsAccumulators();
    const career = createPlayerStatsAccumulator();

    const scorecard = {
      matchId: 'm-sample',
      version: 1,
      originalTarget: null,
      dlsTarget: null,
      effectiveTarget: null,
      innings: cards,
      result,
      display: { players: {}, innings: [] },
    };

    for (const inn of cards) {
      for (const batter of inn.batters) {
        let acc = batting.get(batter.playerId);
        if (!acc) {
          acc = createBattingAccumulator();
          batting.set(batter.playerId, acc);
        }
        applyBatterInnings(acc, 'm-sample', batter);
      }
      for (const bowler of inn.bowlers) {
        let acc = bowling.get(bowler.playerId);
        if (!acc) {
          acc = createBowlingAccumulator();
          bowling.set(bowler.playerId, acc);
        }
        applyBowlerInnings(acc, 'm-sample', bowler);
      }
    }

    foldScorecardIntoTournamentStats(statsAcc, scorecard, new Set(batting.keys()), null, null);

    applyMatchToPlayerStats(
      career,
      BATTER_B2,
      {
        matchId: 'm-sample',
        matchDate: new Date('2024-06-01T12:00:00.000Z'),
        opponentName: 'Atmiya 3',
        groundLocation: 'Test Ground',
        year: 2024,
      },
      scorecard,
    );

    const fielderCareer = createPlayerStatsAccumulator();
    applyMatchToPlayerStats(
      fielderCareer,
      BATTER_A3,
      {
        matchId: 'm-sample',
        matchDate: new Date('2024-06-01T12:00:00.000Z'),
        opponentName: 'Royal Tigers',
        groundLocation: 'Test Ground',
        year: 2024,
      },
      scorecard,
    );

    expect(batting.get(BATTER_A1)?.runs).toBe(34);
    expect(batting.get(BATTER_A1)?.fifties).toBe(0);
    expect(batting.get(BATTER_B1)?.thirties).toBe(1);
    expect(bowling.get(BOWLER_B2)?.wickets).toBe(3);
    expect(statsAcc.sixes).toBe(1 + 1 + 1 + 2);
    expect(statsAcc.fours).toBe(3 + 2 + 1 + 4 + 2 + 1);
    expect(career.runs).toBe(30);
    expect(career.thirties).toBe(1);
    expect(fielderCareer.catches).toBe(1);
  });
});
