import { GraphicsKind } from './live';

/**
 * Uploadable overlay theme slots — one HTML file per cockpit Overlay Control
 * action. Keys reuse {@link GraphicsKind} values (plus the always-on score strip).
 */
export const OVERLAY_THEME_CONTROLS = [
  { key: 'score_strip', label: 'Score strip', section: 'Always on air' },
  { key: GraphicsKind.Toss, label: 'Toss', section: 'Score strip modes' },
  { key: GraphicsKind.Chase, label: 'Runs to win', section: 'Score strip modes' },
  { key: GraphicsKind.Boundaries, label: 'Boundaries', section: 'Score strip modes' },
  { key: GraphicsKind.InningsBreak, label: 'Innings break', section: 'Common' },
  { key: GraphicsKind.WagonWheel, label: 'Wagon Wheel', section: 'Common' },
  { key: GraphicsKind.Partnership, label: 'Current Partnership', section: 'Common' },
  { key: GraphicsKind.PlayingXi, label: 'Playing XI', section: 'Common' },
  { key: GraphicsKind.TossResult, label: 'Toss result', section: 'Common' },
  { key: GraphicsKind.BattingCard, label: 'Batting card', section: 'Team' },
  { key: GraphicsKind.BowlingCard, label: 'Bowling', section: 'Team' },
  { key: GraphicsKind.TeamPartnerships, label: 'Team Partnerships', section: 'Team' },
  { key: GraphicsKind.FallOfWicket, label: 'Last wicket', section: 'Team' },
  { key: GraphicsKind.Batsman, label: 'Batsman', section: 'Team' },
  { key: GraphicsKind.Bowler, label: 'Bowler', section: 'Team' },
  { key: GraphicsKind.BatsmanCareer, label: 'Batsman career', section: 'Team' },
  { key: GraphicsKind.BowlerCareer, label: 'Bowler career', section: 'Team' },
  { key: GraphicsKind.PointsTable, label: 'Point Table', section: 'Tournament' },
  { key: GraphicsKind.TournamentTopBatsmen, label: 'Top 5 Batsmen', section: 'Tournament' },
  { key: GraphicsKind.TournamentTopBowlers, label: 'Top 5 Bowlers', section: 'Tournament' },
  { key: GraphicsKind.TournamentFours, label: 'Tournament Fours', section: 'Tournament' },
  { key: GraphicsKind.TournamentSixes, label: 'Tournament Sixes', section: 'Tournament' },
  { key: GraphicsKind.MostSixes, label: 'Most Sixes', section: 'Tournament' },
  { key: GraphicsKind.MostFours, label: 'Most Fours', section: 'Tournament' },
] as const;

export type OverlayThemeControlKey = (typeof OVERLAY_THEME_CONTROLS)[number]['key'];

export const OVERLAY_THEME_CONTROL_KEYS: readonly OverlayThemeControlKey[] =
  OVERLAY_THEME_CONTROLS.map((control) => control.key);

export function isOverlayThemeControlKey(value: string): value is OverlayThemeControlKey {
  return (OVERLAY_THEME_CONTROL_KEYS as readonly string[]).includes(value);
}

export function overlayThemeControlLabel(key: OverlayThemeControlKey): string {
  return OVERLAY_THEME_CONTROLS.find((control) => control.key === key)?.label ?? key;
}

export const OVERLAY_THEME_NAME_MAX_LENGTH = 60;
export const OVERLAY_THEME_HTML_MAX_BYTES = 512 * 1024;
export const OVERLAY_THEME_HTML_MIME_TYPE = 'text/html';
export const OVERLAY_THEME_HTML_EXTENSION = '.html';
/** Multipart field name for the HTML file on the upload endpoint. */
export const OVERLAY_THEME_UPLOAD_FIELD = 'file';

export function isOverlayThemeHtmlFileName(fileName: string): boolean {
  return fileName.trim().toLowerCase().endsWith(OVERLAY_THEME_HTML_EXTENSION);
}

/** Accepts `text/html` with optional parameters (e.g. `; charset=utf-8`). */
export function isOverlayThemeHtmlMimeType(mimeType: string): boolean {
  return mimeType.split(';')[0]?.trim().toLowerCase() === OVERLAY_THEME_HTML_MIME_TYPE;
}

export function buildOverlayThemeGraphicStorageKey(
  themeId: string,
  controlKey: OverlayThemeControlKey,
): string {
  return `overlay-themes/${themeId}/${controlKey}.html`;
}

export const OVERLAY_THEME_MESSAGES = {
  nameRequired: 'Enter a theme name',
  nameTooLong: `Theme name must be at most ${OVERLAY_THEME_NAME_MAX_LENGTH} characters`,
  nameTaken: 'A theme with this name already exists',
  notFound: 'Theme not found',
  unknownControl: 'Unknown overlay control',
  fileRequired: 'Choose an .html file to upload',
  fileType: 'Only .html files (text/html) are allowed',
  fileSize: `HTML file must be ${OVERLAY_THEME_HTML_MAX_BYTES / 1024} KB or smaller`,
  fileNotText: 'The file is not valid UTF-8 HTML text',
  graphicNotFound: 'No file is uploaded for this control',
  deleteConfirmTitle: 'Delete theme?',
  deleteConfirmMessage: (name: string) =>
    `"${name}" and all of its uploaded HTML files will be permanently deleted.`,
} as const;

export interface OverlayThemeGraphicSummary {
  controlKey: OverlayThemeControlKey;
  fileName: string;
  sizeBytes: number;
  /** ISO 8601 UTC. */
  uploadedAt: string;
}

export interface OverlayThemeSummary {
  id: string;
  name: string;
  /** Number of controls with an uploaded HTML file. */
  uploadedCount: number;
  totalControls: number;
  /** ISO 8601 UTC. */
  createdAt: string;
  /** ISO 8601 UTC. */
  updatedAt: string;
}

export interface OverlayThemeDetail extends OverlayThemeSummary {
  createdByName: string;
  graphics: OverlayThemeGraphicSummary[];
}

export interface CreateOverlayThemeRequest {
  name: string;
}

export interface UpdateOverlayThemeRequest {
  name: string;
}

/** Raw HTML for the sandboxed dashboard preview (never served as a page). */
export interface OverlayThemeGraphicSource {
  controlKey: OverlayThemeControlKey;
  fileName: string;
  html: string;
}
