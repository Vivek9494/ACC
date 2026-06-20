import { formatUtcIsoDate } from '@acc/types';

import {
  isScorerMatchDayToday,
  isWithinScorerAssignmentWindow,
  SCORER_DASHBOARD_CARD_STATES,
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

    it('prefers startTime local date over matchDate when both are set', () => {
      const today = formatUtcIsoDate(new Date());
      expect(
        isScorerMatchDayToday({
          matchDate: new Date('2099-01-01T00:00:00.000Z'),
          startTime: new Date(`${today}T10:30:00.000Z`),
        }),
      ).toBe(true);
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

  describe('isWithinScorerAssignmentWindow', () => {
  it('opens two hours before scheduled start on match day', () => {
    const today = formatUtcIsoDate(new Date());
    const startTime = new Date(`${today}T14:00:00.000Z`);
    const twoHoursBefore = new Date(startTime.getTime() - 2 * 60 * 60 * 1000);
    const tooEarly = new Date(twoHoursBefore.getTime() - 60_000);

    expect(
      isWithinScorerAssignmentWindow({ matchDate: startTime, startTime }, tooEarly),
    ).toBe(false);
    expect(
      isWithinScorerAssignmentWindow({ matchDate: startTime, startTime }, twoHoursBefore),
    ).toBe(true);
  });

  it('returns false on a non-match day', () => {
    const future = new Date('2099-06-08T14:00:00.000Z');
    expect(isWithinScorerAssignmentWindow({ matchDate: future, startTime: future })).toBe(false);
  });
  });

  describe('scorer dashboard card states', () => {
    it('excludes terminal states from pre-live scorer start list', () => {
      expect(SCORER_STARTABLE_MATCH_STATES).not.toContain('LIVE');
      expect(SCORER_STARTABLE_MATCH_STATES).not.toContain('COMPLETED');
      expect(SCORER_STARTABLE_MATCH_STATES).not.toContain('SCORECARD_LOCKED');
    });

    it('includes live states on the scorer dashboard card list', () => {
      expect(SCORER_DASHBOARD_CARD_STATES).toContain('LIVE');
      expect(SCORER_DASHBOARD_CARD_STATES).toContain('RAIN_INTERRUPTED');
      expect(SCORER_DASHBOARD_CARD_STATES).not.toContain('COMPLETED');
    });
  });
});
