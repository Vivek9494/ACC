/**
 * Overlay theme framework — Kind B capable component registry.
 * Each theme registers a full component set (one binding per graphic slot).
 */

import type {
  GraphicsStageController,
  GraphicsStageOptions,
} from '../graphics-stage';

/** Graphic slots a theme may supply — includes future leaderboard / points table. */
export type OverlayGraphicComponentKey =
  | 'score_strip'
  | 'partnership'
  | 'fow'
  | 'batsman'
  | 'bowler'
  | 'batsman_career'
  | 'bowler_career'
  | 'innings_break'
  | 'toss_result'
  | 'playing_xi'
  | 'leaderboard'
  | 'points_table';

export type ThemeGraphicHost = 'score_strip' | 'graphics_stage' | 'standalone';

/** How a graphic is implemented within a theme (supports Kind B swaps per slot). */
export type ThemeGraphicBinding =
  | {
      status: 'implemented';
      host: ThemeGraphicHost;
      /** Module path / implementation id within the theme package. */
      componentId: string;
    }
  | { status: 'pending' };

export type OverlayThemeKey = 'theme1';

export interface ScoreStripRenderParams {
  card: import('../types').ScorecardResponse | null;
  ctx: import('../types').MatchContext | null;
  status: import('../types').ConnectionStatus;
  missingMatchId: boolean;
  crrMode: 'default' | 'toss' | 'chase' | 'boundaries';
  hideStrip?: boolean;
}

/** Score strip + strip-owned graphics (career card, toss/chase/boundaries sub-line). */
export interface ScoreStripHost {
  render(params: ScoreStripRenderParams): void;
  fillCareerCard(
    playerId: string,
    card: import('../types').ScorecardResponse | null,
    career: import('../types').BroadcastPlayerStatsView,
  ): void;
  careerWrapElement(): HTMLDivElement;
  revealCareerCard(): void;
  hideCareerCard(onHidden: () => void, animMs: number): void;
}

export interface OverlayThemeDefinition {
  key: OverlayThemeKey;
  label: string;
  /** Load theme CSS (tokens + graphic styles). */
  loadStyles(): void;
  /** Inject strip, career dock, and stage host markup into #root. */
  injectPageMarkup(root: HTMLElement): void;
  createScoreStripHost(): ScoreStripHost;
  createGraphicsStage(
    root: HTMLElement,
    options: GraphicsStageOptions,
  ): GraphicsStageController;
  /** Full component set — one binding per graphic slot (Kind B registry). */
  components: Record<OverlayGraphicComponentKey, ThemeGraphicBinding>;
}

export type GraphicsStageFactory = OverlayThemeDefinition['createGraphicsStage'];
