/** Shared column widths for innings scorecard Batting and Bowling tables. */

export const SCORECARD_STAT_COLS = ['R', 'B', '4s', '6s', 'SR'] as const;
export type ScorecardStatCol = (typeof SCORECARD_STAT_COLS)[number];

/**
 * Horizontal gap between adjacent numeric stat columns — keeps values like
 * "2" / "227.27" and "0" / "14.00" from touching.
 */
export const SCORECARD_STAT_COLUMN_GAP = 6;

/** Stat column widths — SR is widest for values like "227.27" / "300.00". */
export const SCORECARD_STAT_WIDTHS: Record<ScorecardStatCol, number> = {
  R: 28,
  B: 28,
  '4s': 30,
  '6s': 30,
  SR: 52,
};

/** Gap between the player-name column and the stats block (`pr-3`). */
export const SCORECARD_NAME_COLUMN_GAP = 12;

/** Screen `px-6` + SectionCard `p-4` horizontal padding on the scorecard screen. */
export const SCORECARD_TABLE_HORIZONTAL_INSET = 80;

export function scorecardStatWidth(col: ScorecardStatCol): number {
  return SCORECARD_STAT_WIDTHS[col];
}

export function scorecardBattingStatsTotalWidth(): number {
  const cols = SCORECARD_STAT_COLS.length;
  const widths = SCORECARD_STAT_COLS.reduce((sum, col) => sum + scorecardStatWidth(col), 0);
  return widths + SCORECARD_STAT_COLUMN_GAP * Math.max(0, cols - 1);
}

/** Player name column width so Bowling frozen column matches Batting `flex-1` name area. */
export function scorecardPlayerNameColumnWidth(contentWidth: number): number {
  return Math.max(0, contentWidth - scorecardBattingStatsTotalWidth() - SCORECARD_NAME_COLUMN_GAP);
}

/** Bowling stat widths derived from the batting table tokens. */
export const SCORECARD_BOWLING_STANDARD_STAT_WIDTH = SCORECARD_STAT_WIDTHS.R;
export const SCORECARD_BOWLING_BOUNDARY_STAT_WIDTH = SCORECARD_STAT_WIDTHS['4s'];
export const SCORECARD_BOWLING_RATE_STAT_WIDTH = SCORECARD_STAT_WIDTHS.SR;
