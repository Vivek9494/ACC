import {
  computeBattingAverage,
  computeEconomyRate,
  computeStrikeRate,
  formatLeaderboardAverage,
  formatLeaderboardEconomy,
  formatLeaderboardStrikeRate,
} from '@acc/types';

import {
  applyBatterInnings,
  applyBowlerInnings,
  buildBattingLeaderboardEntries,
  buildBowlingLeaderboardEntries,
  createBattingAccumulator,
  createBowlingAccumulator,
} from './leaderboard.compute';

describe('leaderboard.compute', () => {
  it('accumulates runs, balls, dismissals, and matches batted', () => {
    const acc = createBattingAccumulator();
    applyBatterInnings(acc, 'match-1', { runs: 40, balls: 30, isOut: false });
    applyBatterInnings(acc, 'match-1', { runs: 10, balls: 8, isOut: true });
    applyBatterInnings(acc, 'match-2', { runs: 25, balls: 20, isOut: false });

    expect(acc.runs).toBe(75);
    expect(acc.balls).toBe(58);
    expect(acc.dismissals).toBe(1);
    expect(acc.thirties).toBe(1);
    expect(acc.fifties).toBe(0);
    expect(acc.battedMatchIds).toEqual(new Set(['match-1', 'match-2']));
  });

  it('tallies exclusive 30s and 50s milestone buckets per innings', () => {
    const acc = createBattingAccumulator();
    applyBatterInnings(acc, 'm1', { runs: 45, balls: 40, isOut: true }); // 30s
    applyBatterInnings(acc, 'm2', { runs: 55, balls: 40, isOut: true }); // 50s only
    applyBatterInnings(acc, 'm3', { runs: 100, balls: 60, isOut: false }); // neither
    applyBatterInnings(acc, 'm4', { runs: 29, balls: 20, isOut: true }); // neither
    applyBatterInnings(acc, 'm5', { runs: 50, balls: 35, isOut: true }); // 50s
    applyBatterInnings(acc, 'm6', { runs: 30, balls: 25, isOut: false }); // 30s
    applyBatterInnings(acc, 'm7', { runs: 99, balls: 50, isOut: true }); // 50s

    expect(acc.thirties).toBe(2);
    expect(acc.fifties).toBe(3);
  });

  it('does not count a match when the player never batted', () => {
    const acc = createBattingAccumulator();
    applyBatterInnings(acc, 'match-1', { runs: 0, balls: 0, isOut: false });
    expect(acc.battedMatchIds.size).toBe(0);
    expect(acc.thirties).toBe(0);
    expect(acc.fifties).toBe(0);
  });

  it('sorts by runs descending and assigns ranks', () => {
    const entries = buildBattingLeaderboardEntries([
      {
        userId: 'u1',
        firstName: 'A',
        lastName: 'Alpha',
        profilePhotoUrl: null,
        teamId: 't1',
        teamName: 'Team A',
        teamLogoUrl: null,
        accumulator: {
          runs: 100,
          balls: 80,
          dismissals: 2,
          thirties: 1,
          fifties: 0,
          battedMatchIds: new Set(['m1']),
        },
      },
      {
        userId: 'u2',
        firstName: 'B',
        lastName: 'Beta',
        profilePhotoUrl: null,
        teamId: 't2',
        teamName: 'Team B',
        teamLogoUrl: null,
        accumulator: {
          runs: 150,
          balls: 90,
          dismissals: 3,
          thirties: 0,
          fifties: 2,
          battedMatchIds: new Set(['m1', 'm2']),
        },
      },
    ]);

    expect(entries.map((entry) => entry.rank)).toEqual([1, 2]);
    expect(entries[0]?.userId).toBe('u2');
    expect(entries[0]?.runs).toBe(150);
    expect(entries[0]?.matches).toBe(2);
    expect(entries[0]?.thirties).toBe(0);
    expect(entries[0]?.fifties).toBe(2);
    expect(entries[0]?.average).toBe(50);
    expect(entries[0]?.strikeRate).toBeCloseTo(166.7, 1);
    expect(entries[1]?.thirties).toBe(1);
    expect(entries[1]?.fifties).toBe(0);
  });

  it('accumulates bowling figures and matches bowled', () => {
    const acc = createBowlingAccumulator();
    applyBowlerInnings(acc, 'match-1', { runsConceded: 24, legalBalls: 24, wickets: 2 });
    applyBowlerInnings(acc, 'match-2', { runsConceded: 18, legalBalls: 18, wickets: 1 });

    expect(acc.runsConceded).toBe(42);
    expect(acc.legalBalls).toBe(42);
    expect(acc.wickets).toBe(3);
    expect(acc.innings).toBe(2);
    expect(acc.bestBowling).toEqual({ wickets: 2, runsConceded: 24 });
    expect(acc.bowledMatchIds).toEqual(new Set(['match-1', 'match-2']));
  });

  it('counts Inns only when the bowler actually bowled and picks Best by wickets then runs', () => {
    const acc = createBowlingAccumulator();
    applyBowlerInnings(acc, 'm1', { runsConceded: 40, legalBalls: 24, wickets: 5 });
    applyBowlerInnings(acc, 'm2', { runsConceded: 23, legalBalls: 24, wickets: 5 }); // better: same W, fewer R
    applyBowlerInnings(acc, 'm3', { runsConceded: 10, legalBalls: 18, wickets: 4 }); // worse: fewer W
    applyBowlerInnings(acc, 'm4', { runsConceded: 0, legalBalls: 0, wickets: 0 }); // did not bowl

    expect(acc.innings).toBe(3);
    expect(acc.bestBowling).toEqual({ wickets: 5, runsConceded: 23 });

    const moreWicketsBeatsFewerRuns = createBowlingAccumulator();
    applyBowlerInnings(moreWicketsBeatsFewerRuns, 'a', {
      runsConceded: 10,
      legalBalls: 12,
      wickets: 4,
    });
    applyBowlerInnings(moreWicketsBeatsFewerRuns, 'b', {
      runsConceded: 50,
      legalBalls: 24,
      wickets: 5,
    });
    expect(moreWicketsBeatsFewerRuns.bestBowling).toEqual({ wickets: 5, runsConceded: 50 });
  });

  it('sorts by wickets desc, then lower economy, then fewer matches', () => {
    const entries = buildBowlingLeaderboardEntries([
      {
        userId: 'u1',
        firstName: 'A',
        lastName: 'Alpha',
        profilePhotoUrl: null,
        teamId: 't1',
        teamName: 'Team A',
        teamLogoUrl: null,
        accumulator: {
          runsConceded: 60,
          legalBalls: 60,
          wickets: 10,
          innings: 2,
          bestBowling: { wickets: 5, runsConceded: 20 },
          bowledMatchIds: new Set(['m1', 'm2']),
        },
      },
      {
        userId: 'u2',
        firstName: 'B',
        lastName: 'Beta',
        profilePhotoUrl: null,
        teamId: 't2',
        teamName: 'Team B',
        teamLogoUrl: null,
        accumulator: {
          runsConceded: 40,
          legalBalls: 48,
          wickets: 10,
          innings: 1,
          bestBowling: { wickets: 4, runsConceded: 12 },
          bowledMatchIds: new Set(['m1']),
        },
      },
      {
        userId: 'u3',
        firstName: 'C',
        lastName: 'Charlie',
        profilePhotoUrl: null,
        teamId: 't3',
        teamName: 'Team C',
        teamLogoUrl: null,
        accumulator: {
          runsConceded: 28,
          legalBalls: 28,
          wickets: 8,
          innings: 1,
          bestBowling: { wickets: 3, runsConceded: 14 },
          bowledMatchIds: new Set(['m1']),
        },
      },
    ]);

    expect(entries.map((entry) => entry.userId)).toEqual(['u2', 'u1', 'u3']);
    expect(entries[0]?.economy).toBe(5);
    expect(entries[1]?.economy).toBe(6);
    expect(entries[0]?.innings).toBe(1);
    expect(entries[0]?.bestBowling).toBe('4/12');
    expect(entries[1]?.bestBowling).toBe('5/20');
  });
});

describe('leaderboard stat helpers', () => {
  it('computes average only when dismissed at least once', () => {
    expect(computeBattingAverage(120, 3)).toBe(40);
    expect(computeBattingAverage(54, 0)).toBeNull();
    expect(formatLeaderboardAverage(null)).toBe('–');
  });

  it('computes strike rate from runs and balls faced', () => {
    expect(computeStrikeRate(135, 100)).toBe(135);
    expect(computeStrikeRate(1, 3)).toBeCloseTo(33.33, 2);
    expect(computeStrikeRate(10, 0)).toBeNull();
    expect(formatLeaderboardStrikeRate(112)).toBe('112.00');
    expect(formatLeaderboardStrikeRate(112.4)).toBe('112.40');
  });

  it('computes economy from runs conceded and legal balls', () => {
    expect(computeEconomyRate(28, 28)).toBeCloseTo(6, 2);
    expect(computeEconomyRate(11, 28)).toBeCloseTo(2.36, 2);
    expect(computeEconomyRate(10, 0)).toBeNull();
    expect(formatLeaderboardEconomy(3.82)).toBe('3.82');
    expect(formatLeaderboardEconomy(4)).toBe('4.00');
  });
});
