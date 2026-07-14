import {
  MATCH_CARD_DISPLAY_META,
  MatchCardDisplayState,
  resolveEffectiveStartTime,
  type MatchListItem,
} from '@acc/types';

function formatShortMatchDay(dateOnly: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);
  if (!match) {
    return dateOnly;
  }
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0),
  );
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

function formatMatchListDateLabel(dateOnly: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);
  if (!match) {
    return dateOnly;
  }
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0),
  );
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatMatchTimeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Scheduled date + optional start time for match list cards (e.g. `June 30, 2026 · 5:00 PM`). */
export function formatMatchListScheduleLabel(
  match: Pick<MatchListItem, 'matchDate' | 'startTime' | 'delayMinutes'>,
): string {
  const effectiveStart = resolveEffectiveStartTime({
    matchDate: match.matchDate,
    startTime: match.startTime,
    delayMinutes: match.delayMinutes ?? 0,
  });

  if (!match.matchDate && !effectiveStart && !match.startTime) {
    return '—';
  }

  if (effectiveStart) {
    const datePart = effectiveStart.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    const timePart = formatMatchTimeLabel(effectiveStart.toISOString());
    return `${datePart} · ${timePart}`;
  }

  const datePart = match.matchDate ? formatMatchListDateLabel(match.matchDate) : null;
  if (!match.startTime) {
    return datePart ?? '—';
  }

  const timePart = formatMatchTimeLabel(match.startTime);
  return datePart ? `${datePart} · ${timePart}` : timePart;
}

/** Top-row context label on tournament match cards. */
export function formatMatchListContextLabel(
  match: Pick<
    MatchListItem,
    'displayState' | 'matchDate' | 'startTime' | 'liveScore' | 'delayMinutes'
  >,
): string {
  const meta = MATCH_CARD_DISPLAY_META[match.displayState];

  if (match.displayState === MatchCardDisplayState.Live) {
    const innings = match.liveScore?.inningsNumber ?? 1;
    return `${meta.contextStatusLine} • INNINGS ${innings}`;
  }

  if (match.displayState === MatchCardDisplayState.Cancelled) {
    return formatMatchListScheduleLabel(match);
  }

  if (match.displayState === MatchCardDisplayState.Completed) {
    const day = match.matchDate ? formatShortMatchDay(match.matchDate) : '—';
    return `${day} • ${meta.contextStatusLine}`;
  }

  return formatMatchListScheduleLabel(match);
}

function formatDeletedAtLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Admin deleted-match attribution on tournament match cards. */
export function formatMatchListDeletedAttribution(
  match: Pick<MatchListItem, 'deletedByName' | 'deletedAt'>,
): string {
  if (!match.deletedByName) {
    return 'Deleted';
  }
  if (match.deletedAt) {
    return `Deleted by ${match.deletedByName} · ${formatDeletedAtLabel(match.deletedAt)}`;
  }
  return `Deleted by ${match.deletedByName}`;
}
