import {
  computeParticipationPollClosesAt,
  computeParticipationPollOpensAt,
  DEFAULT_VENUE_TIMEZONE,
  isParticipationPollOpen,
} from '@acc/types';

describe('participation poll schedule', () => {
  const toronto = 'America/Toronto';

  /** Saturday 2025-06-14 at 7:00 AM Toronto (EDT, UTC-4). */
  const saturdaySevenAmToronto = new Date('2025-06-14T11:00:00.000Z');

  /** Same Saturday at 8:00 PM Toronto. */
  const saturdayEightPmToronto = new Date('2025-06-15T00:00:00.000Z');

  const saturdayMatchDateOnly = {
    matchDate: new Date('2025-06-14T00:00:00.000Z'),
    startTime: null as Date | null,
  };

  function zonedParts(iso: Date, timeZone: string) {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      timeZoneName: 'shortOffset',
      hour12: false,
    });
    const parts = formatter.formatToParts(iso);
    const read = (type: Intl.DateTimeFormatPartTypes): string =>
      parts.find((part) => part.type === type)?.value ?? '';
    const offsetRaw = read('timeZoneName');
    const offsetMatch = /GMT([+-]\d+)/.exec(offsetRaw);
    return {
      weekday: read('weekday'),
      month: Number(read('month')),
      day: Number(read('day')),
      hour: Number(read('hour')) % 24,
      minute: Number(read('minute')),
      offset: offsetMatch ? Number(offsetMatch[1]) * 60 : 0,
    };
  }

  it('closes Thursday 5 PM Toronto for a Saturday match (date-anchored)', () => {
    const closesAt = computeParticipationPollClosesAt(saturdayMatchDateOnly, toronto);
    const parts = zonedParts(closesAt, toronto);

    expect(parts.weekday).toBe('Thu');
    expect(parts.month).toBe(6);
    expect(parts.day).toBe(12);
    expect(parts.hour).toBe(17);
    expect(parts.minute).toBe(0);
  });

  it('uses match local date from startTime — 7 AM and 8 PM Saturday share the same close', () => {
    const closeEarly = computeParticipationPollClosesAt(
      { matchDate: new Date('2025-06-14T00:00:00.000Z'), startTime: saturdaySevenAmToronto },
      toronto,
    );
    const closeLate = computeParticipationPollClosesAt(
      { matchDate: new Date('2025-06-14T00:00:00.000Z'), startTime: saturdayEightPmToronto },
      toronto,
    );

    expect(closeEarly.toISOString()).toBe(closeLate.toISOString());
  });

  it('opens five venue-local calendar days before the match at midnight', () => {
    const opensAt = computeParticipationPollOpensAt(saturdayMatchDateOnly, toronto);
    const parts = zonedParts(opensAt, toronto);

    expect(parts.month).toBe(6);
    expect(parts.day).toBe(9);
    expect(parts.hour).toBe(0);
    expect(parts.minute).toBe(0);
  });

  it('is open inside the UTC window and closed at or after the stored close instant', () => {
    const opensAt = computeParticipationPollOpensAt(saturdayMatchDateOnly, toronto);
    const closesAt = computeParticipationPollClosesAt(saturdayMatchDateOnly, toronto);

    expect(isParticipationPollOpen(opensAt, closesAt, new Date(opensAt.getTime() + 60_000))).toBe(
      true,
    );
    expect(
      isParticipationPollOpen(opensAt, closesAt, new Date(closesAt.getTime() - 60_000)),
    ).toBe(true);
    expect(isParticipationPollOpen(opensAt, closesAt, closesAt)).toBe(false);
  });

  it('resolves winter close to 5 PM EST (UTC-5) without drift', () => {
    const winterSaturday = {
      matchDate: new Date('2025-01-11T00:00:00.000Z'),
      startTime: new Date('2025-01-11T15:00:00.000Z'),
    };
    const closesAt = computeParticipationPollClosesAt(winterSaturday, toronto);
    const parts = zonedParts(closesAt, toronto);

    expect(parts.weekday).toBe('Thu');
    expect(parts.day).toBe(9);
    expect(parts.hour).toBe(17);
    expect(parts.offset).toBe(-300);
  });

  it('resolves summer close to 5 PM EDT (UTC-4) without drift', () => {
    const closesAt = computeParticipationPollClosesAt(saturdayMatchDateOnly, toronto);
    const parts = zonedParts(closesAt, toronto);

    expect(parts.hour).toBe(17);
    expect(parts.offset).toBe(-240);
  });

  it('falls back to the default venue timezone constant', () => {
    const closesAt = computeParticipationPollClosesAt(saturdayMatchDateOnly, DEFAULT_VENUE_TIMEZONE);
    expect(zonedParts(closesAt, DEFAULT_VENUE_TIMEZONE).hour).toBe(17);
  });
});
