import { formatUtcIsoDate } from '@acc/types';

import {
  isScorerMatchDayToday,
  SCORER_STARTABLE_MATCH_STATES,
} from './match-start.utils';

describe('match-start.utils', () => {
  describe('isScorerMatchDayToday', () => {
    it('returns true when matchDate is today (UTC)', () => {
      const today = formatUtcIsoDate(new Date());
      expect(
        isScorerMatchDayToday({
          matchDate: new Date(`${today}T14:00:00.000Z`),
          startTime: null,
        }),
      ).toBe(true);
    });

    it('prefers matchDate over startTime when both are set', () => {
      const today = formatUtcIsoDate(new Date());
      expect(
        isScorerMatchDayToday({
          matchDate: new Date('2099-01-01T00:00:00.000Z'),
          startTime: new Date(`${today}T10:30:00.000Z`),
        }),
      ).toBe(false);
    });

    it('returns false for a future match day', () => {
      const today = formatUtcIsoDate(new Date());
      const future = new Date(`${today}T00:00:00.000Z`);
      future.setUTCDate(future.getUTCDate() + 7);
      expect(
        isScorerMatchDayToday({
          matchDate: future,
          startTime: null,
        }),
      ).toBe(false);
    });

    it('returns false when neither matchDate nor startTime is set', () => {
      expect(isScorerMatchDayToday({ matchDate: null, startTime: null })).toBe(false);
    });
  });

  it('excludes terminal and live states from scorer dashboard card', () => {
    expect(SCORER_STARTABLE_MATCH_STATES).not.toContain('LIVE');
    expect(SCORER_STARTABLE_MATCH_STATES).not.toContain('COMPLETED');
    expect(SCORER_STARTABLE_MATCH_STATES).not.toContain('SCORECARD_LOCKED');
  });
});
