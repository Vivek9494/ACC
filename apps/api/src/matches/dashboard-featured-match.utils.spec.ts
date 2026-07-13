import { DEFAULT_VENUE_TIMEZONE, isDashboardFeaturedMatchScheduledToday } from '@acc/types';

import {
  compareDashboardTodayMatchesByTime,
  DASHBOARD_TODAY_MATCHES_LIMIT,
  filterDashboardFeaturedMatchesToToday,
  isDashboardMatchScheduledAfter,
  sortAndLimitDashboardTodayMatchRows,
  sortDashboardMatchesByTimeDesc,
} from './dashboard-featured-match.utils';

describe('filterDashboardFeaturedMatchesToToday', () => {
  const now = new Date('2026-07-04T15:00:00.000Z'); // afternoon UTC = Jul 4 in Toronto

  it('keeps a fixture scheduled today in the venue timezone', () => {
    const rows = [
      {
        matchDate: new Date('2026-07-04T12:00:00.000Z'),
        startTime: new Date('2026-07-04T18:00:00.000Z'),
        tournament: { timezone: DEFAULT_VENUE_TIMEZONE },
      },
    ];

    expect(filterDashboardFeaturedMatchesToToday(rows, now)).toHaveLength(1);
  });

  it('drops past and future fixtures', () => {
    const rows = [
      {
        matchDate: new Date('2026-07-03T12:00:00.000Z'),
        startTime: new Date('2026-07-03T18:00:00.000Z'),
        tournament: { timezone: DEFAULT_VENUE_TIMEZONE },
      },
      {
        matchDate: new Date('2026-07-05T12:00:00.000Z'),
        startTime: new Date('2026-07-05T18:00:00.000Z'),
        tournament: { timezone: DEFAULT_VENUE_TIMEZONE },
      },
    ];

    expect(filterDashboardFeaturedMatchesToToday(rows, now)).toHaveLength(0);
  });

  it('includes completed fixtures from today', () => {
    const match = {
      matchDate: new Date('2026-07-04T12:00:00.000Z'),
      startTime: new Date('2026-07-04T14:00:00.000Z'),
    };
    expect(
      isDashboardFeaturedMatchScheduledToday(match, DEFAULT_VENUE_TIMEZONE, now),
    ).toBe(true);
  });
});

describe('sortAndLimitDashboardTodayMatchRows', () => {
  it('orders by scheduled start time ascending (earliest first)', () => {
    const rows = [
      {
        id: 'match-late',
        matchDate: new Date('2026-07-04T12:00:00.000Z'),
        startTime: new Date('2026-07-04T20:00:00.000Z'),
      },
      {
        id: 'match-early',
        matchDate: new Date('2026-07-04T12:00:00.000Z'),
        startTime: new Date('2026-07-04T14:00:00.000Z'),
      },
    ];

    expect(sortAndLimitDashboardTodayMatchRows(rows).map((row) => row.id)).toEqual([
      'match-early',
      'match-late',
    ]);
  });

  it('breaks identical start times by match id', () => {
    const sameStart = new Date('2026-07-04T11:00:00.000Z');
    const rows = [
      { id: 'match-b', matchDate: new Date('2026-07-04T12:00:00.000Z'), startTime: sameStart },
      { id: 'match-a', matchDate: new Date('2026-07-04T12:00:00.000Z'), startTime: sameStart },
    ];

    expect(compareDashboardTodayMatchesByTime(rows[0]!, rows[1]!)).toBeGreaterThan(0);
    expect(sortAndLimitDashboardTodayMatchRows(rows).map((row) => row.id)).toEqual([
      'match-a',
      'match-b',
    ]);
  });

  it(`caps at ${DASHBOARD_TODAY_MATCHES_LIMIT} earliest fixtures`, () => {
    const rows = Array.from({ length: 12 }, (_, index) => ({
      id: `match-${String(index).padStart(2, '0')}`,
      matchDate: new Date('2026-07-04T12:00:00.000Z'),
      startTime: new Date(`2026-07-04T${String(8 + index).padStart(2, '0')}:00:00.000Z`),
    }));

    const limited = sortAndLimitDashboardTodayMatchRows(rows);
    expect(limited).toHaveLength(DASHBOARD_TODAY_MATCHES_LIMIT);
    expect(limited[0]!.id).toBe('match-00');
    expect(limited[9]!.id).toBe('match-09');
  });
});

describe('sortDashboardMatchesByTimeDesc', () => {
  it('orders by scheduled start time descending (most recent first)', () => {
    const rows = [
      {
        id: 'match-early',
        matchDate: new Date('2026-07-04T12:00:00.000Z'),
        startTime: new Date('2026-07-04T14:00:00.000Z'),
      },
      {
        id: 'match-late',
        matchDate: new Date('2026-07-04T12:00:00.000Z'),
        startTime: new Date('2026-07-04T20:00:00.000Z'),
      },
    ];

    expect(sortDashboardMatchesByTimeDesc(rows).map((row) => row.id)).toEqual([
      'match-late',
      'match-early',
    ]);
  });
});

describe('isDashboardMatchScheduledAfter', () => {
  const now = new Date('2026-07-04T15:00:00.000Z');

  it('is true when start time is in the future', () => {
    expect(
      isDashboardMatchScheduledAfter(
        {
          matchDate: new Date('2026-07-04T12:00:00.000Z'),
          startTime: new Date('2026-07-04T18:00:00.000Z'),
        },
        now,
      ),
    ).toBe(true);
  });

  it('is false when start time is in the past', () => {
    expect(
      isDashboardMatchScheduledAfter(
        {
          matchDate: new Date('2026-07-04T12:00:00.000Z'),
          startTime: new Date('2026-07-04T14:00:00.000Z'),
        },
        now,
      ),
    ).toBe(false);
  });
});
