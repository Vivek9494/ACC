import {
  DEFAULT_VENUE_TIMEZONE,
  selectDashboardTournaments,
  TournamentDisplayStatus,
  deriveTournamentDisplayStatus,
} from '@acc/types';

function entry(
  id: string,
  startAt: string,
  endAt: string,
  cancelled = false,
) {
  return {
    tournament: {
      id,
      startAt,
      endAt,
      timezone: DEFAULT_VENUE_TIMEZONE,
      displayStatus: deriveTournamentDisplayStatus({
        startAt,
        endAt,
        timezone: DEFAULT_VENUE_TIMEZONE,
        cancelled,
      }),
    },
    cancelled,
  };
}

describe('selectDashboardTournaments', () => {
  const now = new Date('2026-06-17T16:00:00.000Z');

  it('returns all upcoming sorted by start date ascending', () => {
    const selected = selectDashboardTournaments(
      [
        entry('b', '2026-07-01T00:00:00.000Z', '2026-07-05T00:00:00.000Z'),
        entry('a', '2026-06-20T00:00:00.000Z', '2026-06-25T00:00:00.000Z'),
        entry('live', '2026-06-10T00:00:00.000Z', '2026-06-30T00:00:00.000Z'),
      ],
      now,
    );
    expect(selected.map((row) => row.tournament.id)).toEqual(['a', 'b']);
  });

  it('returns all live when no upcoming exist', () => {
    const selected = selectDashboardTournaments(
      [
        entry('b', '2026-06-10T00:00:00.000Z', '2026-06-30T00:00:00.000Z'),
        entry('a', '2026-06-01T00:00:00.000Z', '2026-06-25T00:00:00.000Z'),
        entry('done', '2026-01-01T00:00:00.000Z', '2026-05-01T00:00:00.000Z'),
      ],
      now,
    );
    expect(selected.map((row) => row.tournament.id)).toEqual(['a', 'b']);
  });

  it('returns only the most recent completed when no upcoming or live', () => {
    const selected = selectDashboardTournaments(
      [
        entry('older', '2026-01-01T00:00:00.000Z', '2026-03-01T00:00:00.000Z'),
        entry('latest', '2026-04-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z'),
      ],
      now,
    );
    expect(selected).toHaveLength(1);
    expect(selected[0]?.tournament.id).toBe('latest');
  });

  it('excludes cancelled tournaments', () => {
    const selected = selectDashboardTournaments(
      [
        entry('cancelled-upcoming', '2026-07-01T00:00:00.000Z', '2026-07-05T00:00:00.000Z', true),
        entry('live', '2026-06-10T00:00:00.000Z', '2026-06-30T00:00:00.000Z'),
      ],
      now,
    );
    expect(selected).toHaveLength(1);
    expect(selected[0]?.tournament.id).toBe('live');
  });

  it('returns empty when only cancelled tournaments exist', () => {
    const selected = selectDashboardTournaments(
      [entry('cancelled', '2026-07-01T00:00:00.000Z', '2026-07-05T00:00:00.000Z', true)],
      now,
    );
    expect(selected).toEqual([]);
  });

  it('uses date-derived status, not stored lifecycle state', () => {
    const status = deriveTournamentDisplayStatus(
      {
        startAt: '2026-06-10T00:00:00.000Z',
        endAt: '2026-06-30T00:00:00.000Z',
        timezone: DEFAULT_VENUE_TIMEZONE,
      },
      now,
    );
    expect(status).toBe(TournamentDisplayStatus.Live);
  });
});
