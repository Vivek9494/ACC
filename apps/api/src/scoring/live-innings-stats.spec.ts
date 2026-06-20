import {
  deriveChaseEquation,
  deriveLiveInningsRunStats,
  formatChaseNeedsLine,
  formatRunRate,
  LIVE_STATS_MIN_LEGAL_BALLS,
  minimumOversAllotmentFromLegalBalls,
  oversFromLegalBalls,
  PROJECTED_SCORE_REFERENCE_RPO,
  resolveOversAllotment,
} from '@acc/types';

describe('deriveChaseEquation', () => {
  it('matches dashboard chase math (runsNeeded / ballsRemaining / RRR)', () => {
    const legalBalls = 18 * 6 + 4;
    const eq = deriveChaseEquation(145, legalBalls, 214, 25);
    expect(eq.runsNeeded).toBe(69);
    expect(eq.ballsRemaining).toBe(25 * 6 - legalBalls);
    expect(eq.rrrText).toBe(formatRunRate(69 / eq.remainingOvers));
    expect(formatChaseNeedsLine(eq.runsNeeded, eq.ballsRemaining)).toBe(
      'needs 69 runs from 38 balls',
    );
  });
});

describe('minimumOversAllotmentFromLegalBalls', () => {
  it('requires at least one over when nothing has been bowled', () => {
    expect(minimumOversAllotmentFromLegalBalls(0)).toBe(1);
  });

  it('allows exactly completed overs', () => {
    expect(minimumOversAllotmentFromLegalBalls(30)).toBe(5);
  });

  it('rounds up partial overs to the next whole over', () => {
    expect(minimumOversAllotmentFromLegalBalls(32)).toBe(6);
  });
});

describe('resolveOversAllotment', () => {
  it('uses the same fallback order as the dashboard chase line', () => {
    expect(resolveOversAllotment(20, 25, 30)).toBe(20);
    expect(resolveOversAllotment(null, 25, 30)).toBe(25);
    expect(resolveOversAllotment(null, null, 30)).toBe(30);
  });
});

describe('deriveLiveInningsRunStats', () => {
  it('returns null when total overs are unknown', () => {
    expect(
      deriveLiveInningsRunStats({ runs: 10, legalBalls: 6, target: null }, null),
    ).toBeNull();
  });

  it('uses fractional overs for CRR (145 off 18.4 → 7.77)', () => {
    const legalBalls = 18 * 6 + 4;
    expect(oversFromLegalBalls(legalBalls)).toBeCloseTo(18 + 4 / 6);

    const stats = deriveLiveInningsRunStats(
      { runs: 145, legalBalls, target: 214 },
      25,
    );
    expect(stats?.ratesReady).toBe(true);
    expect(stats?.crrText).toBe(formatRunRate(145 / oversFromLegalBalls(legalBalls)));
    expect(stats?.crrText).toBe('7.77');
  });

  it('projects the final score at the current rate after 3 completed overs', () => {
    const legalBalls = 18 * 6 + 4;
    const stats = deriveLiveInningsRunStats(
      { runs: 145, legalBalls, target: null },
      25,
    );
    const crr = 145 / oversFromLegalBalls(legalBalls);
    const remaining = 25 - oversFromLegalBalls(legalBalls);
    expect(stats?.projectedAtCurrent).toBe(Math.round(145 + crr * remaining));
    expect(stats?.projectedAtCurrent).toBe(194);
  });

  it('projects at the reference RPO after 3 completed overs', () => {
    const legalBalls = 18 * 6 + 4;
    const stats = deriveLiveInningsRunStats(
      { runs: 145, legalBalls, target: null },
      25,
    );
    const remaining = 25 - oversFromLegalBalls(legalBalls);
    expect(stats?.projectedAtReferenceRpo).toBe(
      Math.round(145 + PROJECTED_SCORE_REFERENCE_RPO * remaining),
    );
  });

  it('derives chase stats immediately but gates RRR until 3 overs', () => {
    const statsEarly = deriveLiveInningsRunStats(
      { runs: 12, legalBalls: 12, target: 150 },
      20,
    );
    expect(statsEarly?.isChase).toBe(true);
    expect(statsEarly?.chaseNeedsLine).toBe('needs 138 runs from 108 balls');
    expect(statsEarly?.ratesReady).toBe(false);
    expect(statsEarly?.rrrText).toBeNull();
    expect(statsEarly?.crrText).toBe('-');

    const statsLate = deriveLiveInningsRunStats(
      { runs: 145, legalBalls: LIVE_STATS_MIN_LEGAL_BALLS, target: 214 },
      25,
    );
    expect(statsLate?.ratesReady).toBe(true);
    expect(statsLate?.rrrText).toBe(
      formatRunRate(69 / (25 - oversFromLegalBalls(LIVE_STATS_MIN_LEGAL_BALLS))),
    );
  });

  it('hides first-innings rate stats before 3 completed overs', () => {
    const stats = deriveLiveInningsRunStats({ runs: 30, legalBalls: 12, target: null }, 20);
    expect(stats?.ratesReady).toBe(false);
    expect(stats?.crrText).toBe('-');
    expect(stats?.isChase).toBe(false);
  });

  it('shows dash CRR before the first legal ball in chase', () => {
    const stats = deriveLiveInningsRunStats({ runs: 0, legalBalls: 0, target: 150 }, 20);
    expect(stats?.hasBowled).toBe(false);
    expect(stats?.ratesReady).toBe(false);
    expect(stats?.crrText).toBe('-');
    expect(stats?.chaseNeedsLine).toBe('needs 150 runs from 120 balls');
  });
});
