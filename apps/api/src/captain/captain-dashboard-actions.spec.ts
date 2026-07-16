import {
  isAssignScorerButtonVisible,
  isCaptainUpcomingMatchCardVisible,
  isConfirmedListButtonVisible,
  isViewPunchTimeButtonVisible,
} from '@acc/types';

describe('captain dashboard action timing', () => {
  const toronto = 'America/Toronto';
  const matchAnchor = {
    matchDate: new Date('2025-06-14T00:00:00.000Z'),
    startTime: new Date('2025-06-14T18:00:00.000Z'),
  };
  const reportingTime = new Date('2025-06-14T13:00:00.000Z');

  it('shows View Punch Time from reporting time onward (not before)', () => {
    const oneMinuteBefore = new Date(reportingTime.getTime() - 60_000);
    expect(isViewPunchTimeButtonVisible({ reportingTime }, oneMinuteBefore)).toBe(false);
    expect(isViewPunchTimeButtonVisible({ reportingTime }, reportingTime)).toBe(true);
    expect(
      isViewPunchTimeButtonVisible({ reportingTime }, new Date(reportingTime.getTime() + 60_000)),
    ).toBe(true);
  });

  it('shows Assign Scorer only on match day in venue tz', () => {
    const matchDayMorning = new Date('2025-06-14T10:00:00.000Z');
    const dayBefore = new Date('2025-06-13T10:00:00.000Z');
    expect(isAssignScorerButtonVisible(matchAnchor, toronto, matchDayMorning)).toBe(true);
    expect(isAssignScorerButtonVisible(matchAnchor, toronto, dayBefore)).toBe(false);
  });

  it('shows Confirmed List after poll close through end of match day', () => {
    const dayBefore = new Date('2025-06-13T10:00:00.000Z');
    const matchDay = new Date('2025-06-14T10:00:00.000Z');
    expect(isConfirmedListButtonVisible(matchAnchor, false, toronto, dayBefore)).toBe(false);
    expect(isConfirmedListButtonVisible(matchAnchor, true, toronto, dayBefore)).toBe(true);
    expect(isConfirmedListButtonVisible(matchAnchor, true, toronto, matchDay)).toBe(true);
  });

  it('hides the upcoming match card after the venue-local match day ends', () => {
    const matchDayEvening = new Date('2025-06-14T22:00:00.000Z');
    const dayAfter = new Date('2025-06-15T10:00:00.000Z');
    expect(isCaptainUpcomingMatchCardVisible(matchAnchor, toronto, matchDayEvening)).toBe(true);
    expect(isCaptainUpcomingMatchCardVisible(matchAnchor, toronto, dayAfter)).toBe(false);
    expect(isConfirmedListButtonVisible(matchAnchor, true, toronto, dayAfter)).toBe(false);
  });
});
