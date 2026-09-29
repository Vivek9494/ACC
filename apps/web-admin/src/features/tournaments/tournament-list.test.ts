import type { TournamentSummary } from '@acc/types';
import { describe, expect, it } from 'vitest';

import {
  countByStatus,
  DEFAULT_TOURNAMENT_FILTERS,
  filterTournaments,
  formatTournamentDates,
  tournamentLocationLabel,
} from './tournament-list';

function tournament(overrides: Partial<TournamentSummary>): TournamentSummary {
  return {
    id: 't',
    name: 'Tournament',
    year: 2026,
    type: 'APL',
    state: 'LIVE',
    displayStatus: 'LIVE',
    ballType: 'TENNIS',
    posterUrl: null,
    startAt: '2026-06-01T00:00:00.000Z',
    endAt: '2026-06-30T00:00:00.000Z',
    locationAddress: null,
    latitude: null,
    longitude: null,
    provinceId: null,
    scopeDisplay: { citySelection: null, provinceName: 'Ontario', centerNames: [], centerIds: [] },
    timezone: 'America/Toronto',
    teamCount: 8,
    ...overrides,
  };
}

const rows: TournamentSummary[] = [
  tournament({ id: 'acc', name: 'ACC League', type: 'ACC', ballType: 'LEATHER', locationAddress: 'Brampton Ground' }),
  tournament({ id: 'apl', name: 'APL Summer', displayStatus: 'UPCOMING', year: 2027 }),
  tournament({
    id: 'center',
    name: 'Center Cup',
    type: 'CENTER',
    displayStatus: 'COMPLETED',
    scopeDisplay: { citySelection: 'MULTI', provinceName: 'Ontario', centerNames: ['Mississauga', 'Scarborough'], centerIds: [] },
  }),
];

describe('filterTournaments', () => {
  it('returns everything with default filters', () => {
    expect(filterTournaments(rows, DEFAULT_TOURNAMENT_FILTERS)).toHaveLength(3);
  });

  it('combines select filters', () => {
    const ids = filterTournaments(rows, { ...DEFAULT_TOURNAMENT_FILTERS, ballType: 'TENNIS', status: 'COMPLETED' }).map(
      (t) => t.id,
    );
    expect(ids).toEqual(['center']);
  });

  it('searches name, location and year case-insensitively', () => {
    const search = (q: string) =>
      filterTournaments(rows, { ...DEFAULT_TOURNAMENT_FILTERS, search: q }).map((t) => t.id);
    expect(search('summer')).toEqual(['apl']);
    expect(search('BRAMPTON')).toEqual(['acc']);
    expect(search('scarborough')).toEqual(['center']);
    expect(search('2027')).toEqual(['apl']);
  });
});

describe('tournamentLocationLabel', () => {
  it('prefers the venue, then centers, then province', () => {
    expect(rows.map(tournamentLocationLabel)).toEqual([
      'Brampton Ground',
      'Ontario',
      'Mississauga, Scarborough',
    ]);
  });
});

describe('countByStatus', () => {
  it('counts every display status', () => {
    expect(countByStatus(rows)).toEqual({ LIVE: 1, UPCOMING: 1, COMPLETED: 1, CANCELLED: 0 });
  });
});

describe('formatTournamentDates', () => {
  it('formats UTC calendar days without timezone drift', () => {
    expect(formatTournamentDates('2026-06-01T00:00:00.000Z', '2026-06-30T00:00:00.000Z')).toBe(
      'Jun 1 – Jun 30, 2026',
    );
  });

  it('shows one day when start equals end', () => {
    expect(formatTournamentDates('2026-06-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z')).toBe('Jun 1, 2026');
  });

  it('keeps both years across a year boundary', () => {
    expect(formatTournamentDates('2026-12-28T00:00:00.000Z', '2027-01-03T00:00:00.000Z')).toBe(
      'Dec 28, 2026 – Jan 3, 2027',
    );
  });
});
