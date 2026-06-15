import { MatchCardDisplayState, type MatchListItem } from '@acc/types';

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

function formatMatchTimeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Top-row context label on tournament match cards. */
export function formatMatchListContextLabel(
  match: Pick<MatchListItem, 'displayState' | 'matchDate' | 'startTime' | 'liveScore'>,
): string {
  if (match.displayState === MatchCardDisplayState.Live) {
    const innings = match.liveScore?.inningsNumber ?? 1;
    return `LIVE • INNINGS ${innings}`;
  }

  if (match.displayState === MatchCardDisplayState.Completed) {
    const day = match.matchDate ? formatShortMatchDay(match.matchDate) : '—';
    return `${day} • COMPLETED`;
  }

  const day = match.matchDate ? formatShortMatchDay(match.matchDate) : '—';
  const timeSource = match.startTime ?? match.matchDate;
  if (!timeSource) {
    return day;
  }
  const time = match.startTime
    ? formatMatchTimeLabel(match.startTime)
    : formatMatchTimeLabel(`${match.matchDate}T12:00:00.000Z`);
  return `${day} • ${time}`;
}

export function formatMatchLiveScoreLine(
  liveScore: NonNullable<MatchListItem['liveScore']>,
): { score: string; overs: string } {
  return {
    score: `${liveScore.runs}/${liveScore.wickets}`,
    overs: `(${liveScore.oversText} Overs)`,
  };
}
