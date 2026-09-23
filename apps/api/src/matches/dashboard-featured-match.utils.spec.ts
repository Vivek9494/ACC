import {
  DEFAULT_VENUE_TIMEZONE,
  isDashboardFeaturedMatchScheduledToday,
  MatchState,
} from '@acc/types';

import {
  compareDashboardTodayMatchesByTime,
  DASHBOARD_RECENT_MATCH_MAX_AGE_DAYS,
  DASHBOARD_TODAY_MATCHES_LIMIT,
  DASHBOARD_UPCOMING_MATCH_WINDOW_DAYS,
  dashboardRecentMatchDateCutoff,
  excludeUnplayedMatchesInCompletedTournaments,
  filterDashboardFeaturedMatchesToToday,
  filterDashboardRecentMatchesByMatchDate,
  filterDashboardUpcomingMatchesBySchedule,
  isDashboardMatchScheduledAfter,
  isDashboardMatchWithinUpcomingWindow,
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

describe('excludeUnplayedMatchesInCompletedTournaments', () => {
  const now = new Date('2026-09-23T15:00:00.000Z');
  const completedTournament = {
    startAt: '2026-07-01T00:00:00.000Z',
    endAt: '2026-08-15T00:00:00.000Z',
    timezone: DEFAULT_VENUE_TIMEZONE,
  };
  const liveTournament = {
    startAt: '2026-09-20T00:00:00.000Z',
    endAt: '2026-09-30T00:00:00.000Z',
    timezone: DEFAULT_VENUE_TIMEZONE,
  };

  it('hides scheduled-but-unplayed matches from a Completed tournament', () => {
    const rows = [
      { id: 'void-scheduled', state: MatchState.Scheduled, tournament: completedTournament },
      { id: 'void-locked', state: MatchState.PlayingXiLocked, tournament: completedTournament },
    ];

    expect(excludeUnplayedMatchesInCompletedTournaments(rows, now)).toEqual([]);
  });

  it('keeps played matches from a Completed tournament', () => {
    const rows = [
      { id: 'played', state: MatchState.Completed, tournament: completedTournament },
      { id: 'live', state: MatchState.Live, tournament: completedTournament },
    ];

    expect(excludeUnplayedMatchesInCompletedTournaments(rows, now).map((row) => row.id)).toEqual([
      'played',
      'live',
    ]);
  });

  it('keeps unplayed matches from an active / upcoming tournament', () => {
    const rows = [
      { id: 'upcoming', state: MatchState.Scheduled, tournament: liveTournament },
    ];

    expect(excludeUnplayedMatchesInCompletedTournaments(rows, now).map((row) => row.id)).toEqual([
      'upcoming',
    ]);
  });
});

describe('filterDashboardRecentMatchesByMatchDate', () => {
  const now = new Date('2026-09-23T15:00:00.000Z');

  it(`keeps matches on or after the ${DASHBOARD_RECENT_MATCH_MAX_AGE_DAYS}-day cutoff`, () => {
    const cutoff = dashboardRecentMatchDateCutoff(now);
    const rows = [
      { id: 'today', matchDate: new Date('2026-09-23T00:00:00.000Z'), startTime: null },
      { id: 'cutoff', matchDate: new Date(`${cutoff}T00:00:00.000Z`), startTime: null },
      { id: 'stale', matchDate: new Date('2026-08-20T00:00:00.000Z'), startTime: null },
      { id: 'undated', matchDate: null, startTime: new Date('2026-09-22T18:00:00.000Z') },
    ];

    expect(filterDashboardRecentMatchesByMatchDate(rows, now).map((row) => row.id)).toEqual([
      'today',
      'cutoff',
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

describe('filterDashboardUpcomingMatchesBySchedule', () => {
  const now = new Date('2026-07-04T15:00:00.000Z');

  it(`keeps fixtures in (now, now+${DASHBOARD_UPCOMING_MATCH_WINDOW_DAYS}d], including later today`, () => {
    const rows = [
      {
        id: 'past',
        matchDate: new Date('2026-07-04T12:00:00.000Z'),
        startTime: new Date('2026-07-04T14:00:00.000Z'),
      },
      {
        id: 'later-today',
        matchDate: new Date('2026-07-04T12:00:00.000Z'),
        startTime: new Date('2026-07-04T18:00:00.000Z'),
      },
      {
        id: 'in-3d',
        matchDate: new Date('2026-07-07T12:00:00.000Z'),
        startTime: new Date('2026-07-07T18:00:00.000Z'),
      },
      {
        id: 'at-7d',
        matchDate: new Date('2026-07-11T12:00:00.000Z'),
        startTime: new Date('2026-07-11T15:00:00.000Z'),
      },
      {
        id: 'beyond-7d',
        matchDate: new Date('2026-07-12T12:00:00.000Z'),
        startTime: new Date('2026-07-12T15:00:00.000Z'),
      },
      {
        id: 'undated',
        matchDate: null,
        startTime: null,
      },
    ];

    expect(filterDashboardUpcomingMatchesBySchedule(rows, now).map((row) => row.id)).toEqual([
      'later-today',
      'in-3d',
      'at-7d',
    ]);
  });

  it('prefers startTime over matchDate for the window check', () => {
    expect(
      isDashboardMatchWithinUpcomingWindow(
        {
          matchDate: new Date('2026-07-20T12:00:00.000Z'),
          startTime: new Date('2026-07-05T12:00:00.000Z'),
        },
        now,
      ),
    ).toBe(true);
  });
});
