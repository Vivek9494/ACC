/** Shared column widths for innings scorecard Batting and Bowling tables. */

export const SCORECARD_STAT_COLS = ['R', 'B', '4s', '6s', 'SR'] as const;
export type ScorecardStatCol = (typeof SCORECARD_STAT_COLS)[number];

/** Stat column widths — SR is widest for values like "300.0". */
export const SCORECARD_STAT_WIDTHS: Record<ScorecardStatCol, number> = {
  R: 24,
  B: 24,
  '4s': 26,
  '6s': 26,
  SR: 44,
};

/** Gap between the player-name column and the stats block (`pr-3`). */
export const SCORECARD_NAME_COLUMN_GAP = 12;

/** Screen `px-6` + SectionCard `p-4` horizontal padding on the scorecard screen. */
export const SCORECARD_TABLE_HORIZONTAL_INSET = 80;

export function scorecardStatWidth(col: ScorecardStatCol): number {
  return SCORECARD_STAT_WIDTHS[col];
}

export function scorecardBattingStatsTotalWidth(): number {
  return SCORECARD_STAT_COLS.reduce((sum, col) => sum + scorecardStatWidth(col), 0);
}

/** Player name column width so Bowling frozen column matches Batting `flex-1` name area. */
export function scorecardPlayerNameColumnWidth(contentWidth: number): number {
  return Math.max(0, contentWidth - scorecardBattingStatsTotalWidth() - SCORECARD_NAME_COLUMN_GAP);
}

/** Bowling stat widths derived from the batting table tokens. */
export const SCORECARD_BOWLING_STANDARD_STAT_WIDTH = SCORECARD_STAT_WIDTHS.R;
export const SCORECARD_BOWLING_BOUNDARY_STAT_WIDTH = SCORECARD_STAT_WIDTHS['4s'];
export const SCORECARD_BOWLING_RATE_STAT_WIDTH = SCORECARD_STAT_WIDTHS.SR;
