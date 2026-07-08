/** Typography tokens for the Live Scoring Scorecard tab (~one step up from Live). */

export const LIVE_SCORECARD_TYPE = {
  sectionTitle: 'font-sans-semibold text-base text-on-surface-variant',
  body: 'font-sans text-base text-on-surface',
  bodyMuted: 'font-sans text-base text-on-surface-variant',
  bodyBold: 'font-sans-bold text-base text-on-surface',
  bodyPrimary: 'font-sans-bold text-base text-primary',
  label: 'font-sans-semibold text-sm',
  stat: 'font-sans-semibold text-lg',
  statBold: 'font-sans-bold text-lg',
  partnershipRuns: 'font-sans-bold text-4xl leading-none text-on-surface',
  partnershipRunsSuffix: 'font-sans-bold text-xl text-on-surface',
  partnershipMeta: 'font-sans-medium text-base text-on-surface',
  overHeader: 'font-sans-semibold text-sm uppercase tracking-wide text-on-surface-variant',
  emptyState: 'font-sans text-base text-on-surface-variant',
} as const;

/** Shared scorecard table typography — batting card is the source of truth for both tables. */
export const SCORECARD_TABLE_TYPE = {
  pinnedHeader: 'font-sans-semibold text-sm uppercase tracking-wide text-on-surface-variant',
  columnHeader: 'font-sans-semibold text-xs uppercase tracking-wide text-on-surface-variant',
  name: 'font-sans-semibold text-sm',
  value: 'font-sans-semibold text-sm',
  status: 'font-sans text-xs',
} as const;

/**
 * Read-only innings scorecard (`InningsScorecardView` / match Scorecard route) — batting is the
 * name/size reference for the paired bowling table.
 */
export const INNINGS_SCORECARD_TABLE_TYPE = {
  columnHeader: 'font-sans-semibold text-[10px] uppercase tracking-wide text-on-surface-variant',
  playerName: 'font-sans-semibold text-sm',
  playerNameActive: 'font-sans-semibold text-sm text-primary',
  status: 'font-sans text-[11px] text-on-surface-variant',
  statusActive: 'font-sans text-[11px] text-primary',
  stat: 'font-sans text-xs text-on-surface',
  statActive: 'font-sans-semibold text-xs text-primary',
} as const;

/** FoW / Catch Dropped event row — taupe fill (`bg-surface-container-low`), 8px radius. */
export const SCORECARD_WICKET_EVENT_CARD =
  'gap-1 rounded-control bg-surface-container-low px-3 py-2.5';

/** Orange accent shared by FoW headlines and Catch Dropped batsman names. */
export const SCORECARD_WICKET_EVENT_ACCENT = 'text-primary';

/** FoW headline — bold, sm, uppercase, primary accent. */
export const SCORECARD_WICKET_EVENT_HEADLINE = `font-sans-bold text-sm uppercase ${SCORECARD_WICKET_EVENT_ACCENT}`;

/** FoW detail / Catch Dropped secondary line — regular sm body. */
export const SCORECARD_WICKET_EVENT_DETAIL = 'font-sans text-sm text-on-surface';

/** Catch Dropped batsman name — bold sm primary accent (no uppercase). */
export const SCORECARD_WICKET_EVENT_EMPHASIS = `font-sans-bold text-sm ${SCORECARD_WICKET_EVENT_ACCENT}`;

/** Shared scorecard table layout — batting and bowling use the same row/column sizing. */
export const SCORECARD_TABLE_LAYOUT = {
  pinnedColWidth: 128,
  statWidth: 34,
  rateWidth: 42,
  headerHeight: 36,
  rowHeight: 46,
} as const;

export type BowlingTableDensity = 'live' | 'scorecard' | 'innings';

export interface BowlingTableMetrics {
  pinnedColWidth: number;
  scrollStatWidth: number;
  ecoWidth: number;
  headerHeight: number;
  rowHeight: number;
  headerLabelClass: string;
  nameClass: string;
  valueClass: string;
  valueEmphasisClass: string;
  headerCellClass: string;
  headerCellEmphasisClass: string;
}

export const BOWLING_TABLE_METRICS: Record<BowlingTableDensity, BowlingTableMetrics> = {
  live: {
    pinnedColWidth: 120,
    scrollStatWidth: 30,
    ecoWidth: 38,
    headerHeight: 32,
    rowHeight: 36,
    headerLabelClass: 'font-sans-semibold text-xs uppercase tracking-wide text-on-surface-variant',
    nameClass: 'font-sans-semibold text-base',
    valueClass: 'font-sans text-base text-on-surface',
    valueEmphasisClass: 'font-sans-bold text-base text-primary',
    headerCellClass: 'font-sans-semibold text-xs uppercase tracking-wide text-on-surface-variant',
    headerCellEmphasisClass: 'font-sans-semibold text-xs uppercase tracking-wide text-primary',
  },
  scorecard: {
    pinnedColWidth: SCORECARD_TABLE_LAYOUT.pinnedColWidth,
    scrollStatWidth: SCORECARD_TABLE_LAYOUT.statWidth,
    ecoWidth: SCORECARD_TABLE_LAYOUT.rateWidth,
    headerHeight: SCORECARD_TABLE_LAYOUT.headerHeight,
    rowHeight: SCORECARD_TABLE_LAYOUT.rowHeight,
    headerLabelClass: SCORECARD_TABLE_TYPE.pinnedHeader,
    nameClass: SCORECARD_TABLE_TYPE.name,
    valueClass: SCORECARD_TABLE_TYPE.value,
    valueEmphasisClass: `${SCORECARD_TABLE_TYPE.value} text-primary`,
    headerCellClass: SCORECARD_TABLE_TYPE.columnHeader,
    headerCellEmphasisClass: 'font-sans-semibold text-xs uppercase tracking-wide text-primary',
  },
  innings: {
    pinnedColWidth: SCORECARD_TABLE_LAYOUT.pinnedColWidth,
    scrollStatWidth: SCORECARD_TABLE_LAYOUT.statWidth,
    ecoWidth: SCORECARD_TABLE_LAYOUT.rateWidth,
    headerHeight: SCORECARD_TABLE_LAYOUT.headerHeight,
    rowHeight: SCORECARD_TABLE_LAYOUT.rowHeight,
    headerLabelClass: INNINGS_SCORECARD_TABLE_TYPE.columnHeader,
    nameClass: INNINGS_SCORECARD_TABLE_TYPE.playerName,
    valueClass: INNINGS_SCORECARD_TABLE_TYPE.stat,
    valueEmphasisClass: INNINGS_SCORECARD_TABLE_TYPE.statActive,
    headerCellClass: INNINGS_SCORECARD_TABLE_TYPE.columnHeader,
    headerCellEmphasisClass: `${INNINGS_SCORECARD_TABLE_TYPE.columnHeader} text-primary`,
  },
};

export interface BattingTableMetrics {
  pinnedColWidth: number;
  statWidth: number;
  srWidth: number;
  headerHeight: number;
  rowHeight: number;
  pinnedHeaderClass: string;
  columnHeaderClass: string;
  nameClass: string;
  statusClass: string;
  valueClass: string;
}

/** Scorecard batting table — only used on the Live Scoring Scorecard tab. */
export const SCORECARD_BATTING_TABLE_METRICS: BattingTableMetrics = {
  pinnedColWidth: SCORECARD_TABLE_LAYOUT.pinnedColWidth,
  statWidth: SCORECARD_TABLE_LAYOUT.statWidth,
  srWidth: SCORECARD_TABLE_LAYOUT.rateWidth,
  headerHeight: SCORECARD_TABLE_LAYOUT.headerHeight,
  rowHeight: SCORECARD_TABLE_LAYOUT.rowHeight,
  pinnedHeaderClass: SCORECARD_TABLE_TYPE.pinnedHeader,
  columnHeaderClass: SCORECARD_TABLE_TYPE.columnHeader,
  nameClass: SCORECARD_TABLE_TYPE.name,
  statusClass: SCORECARD_TABLE_TYPE.status,
  valueClass: SCORECARD_TABLE_TYPE.value,
};
