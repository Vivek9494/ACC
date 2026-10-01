/**
 * Web-admin overlay preview: the scoring overlay renders one graphic from a
 * built-in sample dataset (no socket, no API) inside a dashboard iframe.
 */

export const OVERLAY_PREVIEW_PATH = '/preview.html';

export const OVERLAY_PREVIEW_GROUPS = [
  { key: 'strip', label: 'Score strip' },
  { key: 'players', label: 'Players' },
  { key: 'partnerships', label: 'Partnerships & wickets' },
  { key: 'pre_match', label: 'Pre-match' },
  { key: 'scorecards', label: 'Scorecards' },
  { key: 'innings_break', label: 'Innings break' },
  { key: 'tournament', label: 'Tournament' },
] as const;

export type OverlayPreviewGroup = (typeof OVERLAY_PREVIEW_GROUPS)[number]['key'];

export const OVERLAY_PREVIEW_GRAPHICS = [
  { key: 'strip', group: 'strip', label: 'Score strip' },
  { key: 'strip_toss', group: 'strip', label: 'Strip — toss face' },
  { key: 'strip_chase', group: 'strip', label: 'Strip — runs to win face' },
  { key: 'strip_boundaries', group: 'strip', label: 'Strip — boundaries face' },
  { key: 'boundary_four', group: 'strip', label: 'Boundary tracker — four' },
  { key: 'boundary_six', group: 'strip', label: 'Boundary tracker — six' },
  { key: 'batsman', group: 'players', label: 'Batsman (this match)' },
  { key: 'bowler', group: 'players', label: 'Bowler (this match)' },
  { key: 'batsman_career', group: 'players', label: 'Batsman career' },
  { key: 'bowler_career', group: 'players', label: 'Bowler career' },
  { key: 'partnership', group: 'partnerships', label: 'Current partnership' },
  { key: 'fow', group: 'partnerships', label: 'Last wicket' },
  { key: 'team_partnerships', group: 'partnerships', label: 'Team partnerships' },
  { key: 'toss_result', group: 'pre_match', label: 'Toss result' },
  { key: 'playing_xi', group: 'pre_match', label: 'Playing XI — both teams' },
  { key: 'playing_xi_single', group: 'pre_match', label: 'Playing XI — one team' },
  { key: 'playing_xi_lineup', group: 'pre_match', label: 'Batting lineup' },
  { key: 'batting_card', group: 'scorecards', label: 'Batting card' },
  { key: 'bowling_card', group: 'scorecards', label: 'Bowling card' },
  { key: 'innings_break_batting', group: 'innings_break', label: 'Batting' },
  { key: 'innings_break_bowling', group: 'innings_break', label: 'Bowling' },
  { key: 'innings_break_fow', group: 'innings_break', label: 'Fall of wickets' },
  { key: 'innings_break_partnerships', group: 'innings_break', label: 'Partnerships' },
  { key: 'innings_break_overs', group: 'innings_break', label: 'Over by over' },
  { key: 'points_table', group: 'tournament', label: 'Points table' },
  { key: 'tournament_top_batsmen', group: 'tournament', label: 'Most runs' },
  { key: 'tournament_top_bowlers', group: 'tournament', label: 'Most wickets' },
  { key: 'tournament_fours', group: 'tournament', label: 'Tournament fours' },
  { key: 'tournament_sixes', group: 'tournament', label: 'Tournament sixes' },
  { key: 'most_fours', group: 'tournament', label: 'Most fours' },
  { key: 'most_sixes', group: 'tournament', label: 'Most sixes' },
] as const satisfies ReadonlyArray<{ key: string; group: OverlayPreviewGroup; label: string }>;

export type OverlayPreviewGraphicKey = (typeof OVERLAY_PREVIEW_GRAPHICS)[number]['key'];

export const DEFAULT_OVERLAY_PREVIEW_GRAPHIC: OverlayPreviewGraphicKey = 'strip';

export const OVERLAY_PREVIEW_DATASETS = [
  { key: 'standard', label: 'Standard' },
  { key: 'edge', label: 'Edge cases' },
] as const;

export type OverlayPreviewDataset = (typeof OVERLAY_PREVIEW_DATASETS)[number]['key'];

export const DEFAULT_OVERLAY_PREVIEW_DATASET: OverlayPreviewDataset = 'standard';

export function isOverlayPreviewGraphicKey(value: string): value is OverlayPreviewGraphicKey {
  return OVERLAY_PREVIEW_GRAPHICS.some((graphic) => graphic.key === value);
}

export function isOverlayPreviewDataset(value: string): value is OverlayPreviewDataset {
  return OVERLAY_PREVIEW_DATASETS.some((dataset) => dataset.key === value);
}

/** Path + query for the overlay preview page (`?preview=1&graphic=…&dataset=…`). */
export function buildOverlayPreviewPath(
  graphic: OverlayPreviewGraphicKey,
  dataset: OverlayPreviewDataset,
): string {
  const params = new URLSearchParams({ preview: '1', graphic, dataset });
  return `${OVERLAY_PREVIEW_PATH}?${params.toString()}`;
}

/** Dashboard → preview iframe. `show`/`replay` play the entrance; `hide` plays the exit. */
export type OverlayPreviewMessageType = 'show' | 'replay' | 'hide';

export interface OverlayPreviewMessage {
  type: OverlayPreviewMessageType;
}

export function parseOverlayPreviewMessage(data: unknown): OverlayPreviewMessage | null {
  if (typeof data !== 'object' || data === null || !('type' in data)) {
    return null;
  }
  const { type } = data;
  return type === 'show' || type === 'replay' || type === 'hide' ? { type } : null;
}
