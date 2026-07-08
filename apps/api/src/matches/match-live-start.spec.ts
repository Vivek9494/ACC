import {
  computeLiveStartAllowedAt,
  formatLiveStartAllowedAtLine,
  isLiveStartTimeWindowOpen,
  LIVE_START_LEAD_MS,
  matchScheduledKickoffInstant,
} from '@acc/types';

describe('match live start window', () => {
  const toronto = 'America/Toronto';

  it('computes startAllowedAt as kickoff minus 30 minutes', () => {
    const kickoff = new Date('2026-07-05T11:00:00.000Z'); // 7:00 AM EDT
    const match = { matchDate: new Date('2026-07-05T04:00:00.000Z'), startTime: kickoff };

    const allowedAt = computeLiveStartAllowedAt(match);

    expect(allowedAt?.getTime()).toBe(kickoff.getTime() - LIVE_START_LEAD_MS);
    expect(formatLiveStartAllowedAtLine(match, toronto)).toMatch(/6:30 AM/);
  });

  it('blocks start on Jul 4 for a Jul 5 7:00 AM EDT fixture', () => {
    const kickoff = new Date('2026-07-05T11:00:00.000Z');
    const match = { matchDate: new Date('2026-07-05T04:00:00.000Z'), startTime: kickoff };
    const jul4 = new Date('2026-07-04T20:00:00.000Z');

    expect(isLiveStartTimeWindowOpen(match, jul4)).toBe(false);
  });

  it('opens at Jul 5 6:30 AM EDT for a Jul 5 7:00 AM EDT fixture', () => {
    const kickoff = new Date('2026-07-05T11:00:00.000Z');
    const match = { matchDate: new Date('2026-07-05T04:00:00.000Z'), startTime: kickoff };
    const at630 = new Date('2026-07-05T10:30:00.000Z');

    expect(isLiveStartTimeWindowOpen(match, at630)).toBe(true);
  });

  it('prefers startTime over matchDate for kickoff instant', () => {
    const match = {
      matchDate: new Date('2026-07-01T04:00:00.000Z'),
      startTime: new Date('2026-07-05T11:00:00.000Z'),
    };

    expect(matchScheduledKickoffInstant(match)?.toISOString()).toBe(
      '2026-07-05T11:00:00.000Z',
    );
  });
});
