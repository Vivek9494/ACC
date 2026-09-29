import {
  canViewAdminAnalytics,
  defaultPasswordResetOtpRange,
  formatPasswordResetOtpDayLabel,
  UserRole,
  validatePasswordResetOtpRange,
  type AdminUsersByGeographyProvince,
  type TournamentSummary,
} from '@acc/types';
import { describe, expect, it } from 'vitest';

import { filterGeography, geographyTotals, sharePercent, sortGeography } from './geography/geography-breakdown';
import { resolveOtpRange, selectedDayInRange, summarizeOtpSeries } from './otp/otp-analytics';
import { statisticsSectionsFor } from './statistics-sections';
import {
  bestBowlingSortValue,
  parseStatView,
  resolveSelectedTournament,
  sortTournamentsForStats,
} from './tournament-stats/tournament-stats';

const NOW = new Date('2026-09-28T23:30:00.000Z');

describe('OTP range helpers', () => {
  it('builds an inclusive UTC window ending today', () => {
    expect(defaultPasswordResetOtpRange(7, NOW)).toEqual({ fromDate: '2026-09-22', toDate: '2026-09-28' });
    expect(resolveOtpRange({ kind: 'preset', days: 30 }, NOW)).toEqual({ fromDate: '2026-08-30', toDate: '2026-09-28' });
  });

  it('passes custom ranges through unchanged', () => {
    const range = { fromDate: '2026-01-01', toDate: '2026-01-31' };
    expect(resolveOtpRange({ kind: 'custom', range }, NOW)).toBe(range);
  });

  it('validates custom ranges like the api (order, real dates, 90-day cap)', () => {
    expect(validatePasswordResetOtpRange({ fromDate: '2026-01-01', toDate: '2026-03-31' })).toBeNull();
    expect(validatePasswordResetOtpRange({ fromDate: '2026-01-01', toDate: '2026-04-01' })).toMatch(/90 days/);
    expect(validatePasswordResetOtpRange({ fromDate: '2026-02-10', toDate: '2026-02-01' })).toMatch(/on or before/);
    expect(validatePasswordResetOtpRange({ fromDate: '', toDate: '2026-02-01' })).toMatch(/both/);
    expect(validatePasswordResetOtpRange({ fromDate: '2026-02-30', toDate: '2026-03-01' })).toMatch(/both/);
  });

  it('labels days in UTC regardless of the browser zone', () => {
    expect(formatPasswordResetOtpDayLabel('2026-09-01')).toBe('Sep 1');
  });

  it('summarizes a series (total, active days, average, earliest peak)', () => {
    const summary = summarizeOtpSeries([
      { date: '2026-09-26', count: 0 },
      { date: '2026-09-27', count: 4 },
      { date: '2026-09-28', count: 4 },
      { date: '2026-09-29', count: 1 },
    ]);
    expect(summary).toEqual({ total: 9, activeDays: 3, averagePerDay: 2.3, peak: { date: '2026-09-27', count: 4 } });
    expect(summarizeOtpSeries([{ date: '2026-09-26', count: 0 }]).peak).toBeNull();
  });

  it('drops the drill-down day once it falls outside the range', () => {
    const range = { fromDate: '2026-09-22', toDate: '2026-09-28' };
    expect(selectedDayInRange('2026-09-25', range)).toBe('2026-09-25');
    expect(selectedDayInRange('2026-09-01', range)).toBeNull();
    expect(selectedDayInRange(null, range)).toBeNull();
  });
});

describe('statistics sections', () => {
  it('shows OTP + Geography to Admin only; Club Manager gets tournament stats', () => {
    expect(canViewAdminAnalytics(UserRole.Admin)).toBe(true);
    expect(canViewAdminAnalytics(UserRole.ClubManager)).toBe(false);
    expect(statisticsSectionsFor(UserRole.Admin).map((s) => s.path)).toEqual(['otp', 'geography', 'tournaments']);
    expect(statisticsSectionsFor(UserRole.ClubManager).map((s) => s.path)).toEqual(['tournaments']);
  });
});

const PROVINCES: AdminUsersByGeographyProvince[] = [
  {
    provinceId: 'on',
    name: 'Ontario',
    userCount: 30,
    centers: [
      { centerId: 'bra', name: 'Brampton', userCount: 20 },
      { centerId: 'tor', name: 'Toronto', userCount: 10 },
      { centerId: 'ott', name: 'Ottawa', userCount: 0 },
    ],
  },
  {
    provinceId: 'ab',
    name: 'Alberta',
    userCount: 45,
    centers: [{ centerId: 'cal', name: 'Calgary', userCount: 45 }],
  },
];

describe('geography breakdown', () => {
  it('totals users, provinces and centers', () => {
    expect(geographyTotals(PROVINCES)).toEqual({ users: 75, provinces: 2, centers: 4 });
  });

  it('keeps every center on a province match and re-sums on a center match', () => {
    expect(filterGeography(PROVINCES, 'alb')).toEqual([PROVINCES[1]]);
    const toronto = filterGeography(PROVINCES, 'tor');
    expect(toronto).toHaveLength(1);
    expect(toronto[0]?.centers.map((c) => c.name)).toEqual(['Toronto']);
    expect(toronto[0]?.userCount).toBe(10);
    expect(filterGeography(PROVINCES, 'zzz')).toEqual([]);
  });

  it('sorts provinces and centers by users (desc) or name', () => {
    const byUsers = sortGeography(PROVINCES, 'users');
    expect(byUsers.map((p) => p.name)).toEqual(['Alberta', 'Ontario']);
    expect(byUsers[1]?.centers.map((c) => c.name)).toEqual(['Brampton', 'Toronto', 'Ottawa']);
    const byName = sortGeography(PROVINCES, 'name');
    expect(byName[1]?.centers.map((c) => c.name)).toEqual(['Brampton', 'Ottawa', 'Toronto']);
  });

  it('computes shares with one decimal and guards ÷0', () => {
    expect(sharePercent(20, 75)).toBe(26.7);
    expect(sharePercent(5, 0)).toBe(0);
  });
});

function tournament(id: string, displayStatus: TournamentSummary['displayStatus'], startAt: string): TournamentSummary {
  return {
    id,
    name: id,
    year: 2026,
    type: 'APL',
    state: 'LIVE',
    displayStatus,
    ballType: 'TENNIS',
    posterUrl: null,
    startAt,
    endAt: startAt,
    locationAddress: null,
    latitude: null,
    longitude: null,
    provinceId: null,
    scopeDisplay: { citySelection: null, provinceName: 'Ontario', centerNames: [], centerIds: [] },
    timezone: 'America/Toronto',
    teamCount: 8,
  };
}

describe('tournament stats helpers', () => {
  const list = [
    tournament('old-done', 'COMPLETED', '2025-06-01T00:00:00.000Z'),
    tournament('next', 'UPCOMING', '2026-11-01T00:00:00.000Z'),
    tournament('recent-done', 'COMPLETED', '2026-07-01T00:00:00.000Z'),
    tournament('live', 'LIVE', '2026-09-01T00:00:00.000Z'),
  ];

  it('orders live, then completed (newest first), then upcoming', () => {
    expect(sortTournamentsForStats(list).map((t) => t.id)).toEqual(['live', 'recent-done', 'old-done', 'next']);
  });

  it('keeps a valid requested tournament, else falls back to the first', () => {
    const sorted = sortTournamentsForStats(list);
    expect(resolveSelectedTournament(sorted, 'old-done')?.id).toBe('old-done');
    expect(resolveSelectedTournament(sorted, 'gone')?.id).toBe('live');
    expect(resolveSelectedTournament([], null)).toBeNull();
  });

  it('parses the view param with a batting default', () => {
    expect(parseStatView('points')).toBe('points');
    expect(parseStatView('nope')).toBe('batting');
    expect(parseStatView(null)).toBe('batting');
  });

  it('ranks best bowling by wickets, then fewer runs', () => {
    expect(bestBowlingSortValue('5/23')).toBeGreaterThan(bestBowlingSortValue('5/30'));
    expect(bestBowlingSortValue('5/30')).toBeGreaterThan(bestBowlingSortValue('4/2'));
    expect(bestBowlingSortValue(null)).toBe(Number.NEGATIVE_INFINITY);
  });
});
