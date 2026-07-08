import { MatchState } from '@acc/types';

import { isDashboardScorerCardVisible } from './match-start.utils';

describe('isDashboardScorerCardVisible', () => {
  const toronto = 'America/Toronto';
  const referenceNow = new Date('2026-07-01T18:00:00.000Z');

  const futureMatch = {
    matchDate: new Date('2099-06-01T00:00:00.000Z'),
    startTime: new Date('2099-06-01T14:00:00.000Z'),
  };

  const pastMatch = {
    matchDate: new Date('2026-03-30T04:00:00.000Z'),
    startTime: new Date('2026-03-30T18:00:00.000Z'),
  };

  const todayMatch = {
    matchDate: new Date('2026-07-01T04:00:00.000Z'),
    startTime: new Date('2026-07-01T22:00:00.000Z'),
  };

  it('hides live fixtures on a past scheduled calendar day', () => {
    expect(
      isDashboardScorerCardVisible(MatchState.Live, pastMatch, toronto, referenceNow),
    ).toBe(false);
  });

  it('hides in-progress XI-locked fixtures on a past scheduled calendar day', () => {
    expect(
      isDashboardScorerCardVisible(
        MatchState.PlayingXiLocked,
        pastMatch,
        toronto,
        referenceNow,
      ),
    ).toBe(false);
  });

  it('shows live fixtures scheduled for today', () => {
    expect(
      isDashboardScorerCardVisible(MatchState.Live, todayMatch, toronto, referenceNow),
    ).toBe(true);
  });

  it('shows Playing XI Locked for future fixtures before match day', () => {
    expect(
      isDashboardScorerCardVisible(
        MatchState.PlayingXiLocked,
        futureMatch,
        toronto,
        referenceNow,
      ),
    ).toBe(true);
  });

  it('shows live fixtures on future calendar days', () => {
    expect(
      isDashboardScorerCardVisible(MatchState.Live, futureMatch, toronto, referenceNow),
    ).toBe(true);
  });

  it('waits until match day for pure SCHEDULED fixtures', () => {
    expect(
      isDashboardScorerCardVisible(MatchState.Scheduled, futureMatch, toronto, referenceNow),
    ).toBe(false);
  });

  it('shows pure SCHEDULED fixtures on match day', () => {
    expect(
      isDashboardScorerCardVisible(MatchState.Scheduled, todayMatch, toronto, referenceNow),
    ).toBe(true);
  });
});
