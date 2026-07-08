import { DEFAULT_VENUE_TIMEZONE, formatPollVoteTimeLabel } from '@acc/types';

describe('formatPollVoteTimeLabel', () => {
  const zone = DEFAULT_VENUE_TIMEZONE;

  it('uses "Voted at {time}" when the vote was cast today in venue-local time', () => {
    const now = new Date('2026-06-17T20:00:00.000Z');
    const votedAt = '2026-06-17T18:30:00.000Z';
    expect(formatPollVoteTimeLabel(votedAt, zone, now)).toMatch(/^Voted at \d/);
    expect(formatPollVoteTimeLabel(votedAt, zone, now)).not.toContain('Jun');
  });

  it('uses "{date} · {time}" when the vote was cast on another day', () => {
    const now = new Date('2026-06-17T20:00:00.000Z');
    const votedAt = '2026-06-10T18:30:00.000Z';
    expect(formatPollVoteTimeLabel(votedAt, zone, now)).toMatch(/^Voted Jun 10 · /);
  });
});
