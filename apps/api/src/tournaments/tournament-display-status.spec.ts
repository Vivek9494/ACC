import {
  DEFAULT_VENUE_TIMEZONE,
  deriveTournamentDisplayStatus,
  TournamentDisplayStatus,
} from '@acc/types';

describe('deriveTournamentDisplayStatus', () => {
  const zone = DEFAULT_VENUE_TIMEZONE;

  it('returns Upcoming before the start date in venue local time', () => {
    const now = new Date('2026-06-14T12:00:00.000Z');
    expect(
      deriveTournamentDisplayStatus(
        {
          startAt: '2026-06-15T00:00:00.000Z',
          endAt: '2026-06-20T00:00:00.000Z',
          timezone: zone,
        },
        now,
      ),
    ).toBe(TournamentDisplayStatus.Upcoming);
  });

  it('returns Live on the start date at local midnight boundary', () => {
    const now = new Date('2026-06-15T04:00:00.000Z');
    expect(
      deriveTournamentDisplayStatus(
        {
          startAt: '2026-06-15T00:00:00.000Z',
          endAt: '2026-06-20T00:00:00.000Z',
          timezone: zone,
        },
        now,
      ),
    ).toBe(TournamentDisplayStatus.Live);
  });

  it('returns Live on the last scheduled date', () => {
    const now = new Date('2026-06-20T23:59:00.000Z');
    expect(
      deriveTournamentDisplayStatus(
        {
          startAt: '2026-06-15T00:00:00.000Z',
          endAt: '2026-06-20T00:00:00.000Z',
          timezone: zone,
        },
        now,
      ),
    ).toBe(TournamentDisplayStatus.Live);
  });

  it('returns Completed after the last date in venue local time', () => {
    const now = new Date('2026-06-21T04:00:00.000Z');
    expect(
      deriveTournamentDisplayStatus(
        {
          startAt: '2026-06-15T00:00:00.000Z',
          endAt: '2026-06-20T00:00:00.000Z',
          timezone: zone,
        },
        now,
      ),
    ).toBe(TournamentDisplayStatus.Completed);
  });

  it('returns Cancelled regardless of dates when cancelled flag is set', () => {
    const now = new Date('2026-06-17T12:00:00.000Z');
    expect(
      deriveTournamentDisplayStatus(
        {
          startAt: '2026-06-15T00:00:00.000Z',
          endAt: '2026-06-20T00:00:00.000Z',
          timezone: zone,
          cancelled: true,
        },
        now,
      ),
    ).toBe(TournamentDisplayStatus.Cancelled);
  });

  it('ignores stored lifecycle state — Live window applies even when state is pre-live', () => {
    const now = new Date('2026-06-17T12:00:00.000Z');
    expect(
      deriveTournamentDisplayStatus(
        {
          startAt: '2026-06-15T00:00:00.000Z',
          endAt: '2026-06-20T00:00:00.000Z',
          timezone: zone,
        },
        now,
      ),
    ).toBe(TournamentDisplayStatus.Live);
  });
});
