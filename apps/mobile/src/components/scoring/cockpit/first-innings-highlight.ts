import { InningsType, type ScorecardResponse, type TimelineEntry } from '@acc/types';

/** Delay after innings-1 closes / match completes so the last ~3s clip attach can land. */
export const HIGHLIGHT_BUILD_DELAY_MS = 5_000;

/** @deprecated Use {@link HIGHLIGHT_BUILD_DELAY_MS}. */
export const FIRST_INNINGS_HIGHLIGHT_BUILD_DELAY_MS = HIGHLIGHT_BUILD_DELAY_MS;

export type HighlightKind = 'innings-1' | 'full-match';

function hasVideoPath(e: TimelineEntry): e is TimelineEntry & { videoPath: string } {
  return typeof e.videoPath === 'string' && e.videoPath.trim().length > 0;
}

function clipPathsFromInningsTimeline(
  timeline: TimelineEntry[],
): string[] {
  return timeline
    .filter(hasVideoPath)
    .slice()
    .sort((a, b) => a.sequence - b.sequence)
    .map((e) => e.videoPath.trim());
}

/**
 * Innings-1 timeline rows that have an attached local clip, in ball order.
 */
export function collectFirstInningsClipPaths(card: ScorecardResponse | null | undefined): string[] {
  if (!card) {
    return [];
  }
  const first =
    card.innings.find((i) => i.inningsType === InningsType.Normal && i.sequence === 1) ??
    card.innings.find((i) => i.sequence === 1);
  if (!first) {
    return [];
  }
  return clipPathsFromInningsTimeline(first.timeline);
}

/**
 * All clips from both (all) innings: innings-first by innings.sequence, then ball order.
 * Never sort by over.ball alone across innings.
 */
export function collectFullMatchClipPaths(card: ScorecardResponse | null | undefined): string[] {
  if (!card) {
    return [];
  }
  const innings = card.innings
    .slice()
    .sort((a, b) => a.sequence - b.sequence);
  const paths: string[] = [];
  for (const inn of innings) {
    paths.push(...clipPathsFromInningsTimeline(inn.timeline));
  }
  return paths;
}

/** True when Normal innings 1 is closed (break / chase transition). */
export function isFirstInningsClosed(card: ScorecardResponse | null | undefined): boolean {
  if (!card) {
    return false;
  }
  const first =
    card.innings.find((i) => i.inningsType === InningsType.Normal && i.sequence === 1) ??
    card.innings.find((i) => i.sequence === 1);
  return Boolean(first?.closed);
}

/** Match finished — full-match highlight trigger. */
export function isMatchCompleted(matchState: string | null | undefined): boolean {
  return matchState === 'COMPLETED' || matchState === 'SCORECARD_LOCKED';
}
