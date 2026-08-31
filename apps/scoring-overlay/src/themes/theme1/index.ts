import { createTheme1GraphicsStage } from '../../theme1/create-graphics-stage';
import type { OverlayThemeDefinition } from '../types';
import { THEME1_PAGE_MARKUP } from './page-markup';
import { createTheme1ScoreStripHost } from './score-strip';

import '../../style.css';

/** Theme 1 — complete component set (ASC navy strip + legacy full-screen cards). */
export const theme1Definition: OverlayThemeDefinition = {
  key: 'theme1',
  label: 'Theme 1',

  loadStyles(): void {
    // Side-effect import of style.css (strip tokens + career dock + stage chrome).
  },

  injectPageMarkup(root: HTMLElement): void {
    root.innerHTML = THEME1_PAGE_MARKUP;
  },

  createScoreStripHost: createTheme1ScoreStripHost,

  createGraphicsStage(root, options) {
    return createTheme1GraphicsStage(root, options);
  },

  components: {
    score_strip: {
      status: 'implemented',
      host: 'score_strip',
      componentId: 'theme1/score-strip',
    },
    partnership: {
      status: 'implemented',
      host: 'graphics_stage',
      componentId: 'theme1/graphics-stage:inline-partnership',
    },
    fow: {
      status: 'implemented',
      host: 'graphics_stage',
      componentId: 'theme1/graphics-stage:inline-fow',
    },
    batsman: {
      status: 'implemented',
      host: 'graphics_stage',
      componentId: 'theme1/graphics-stage:inline-batsman',
    },
    bowler: {
      status: 'implemented',
      host: 'graphics_stage',
      componentId: 'theme1/graphics-stage:inline-bowler',
    },
    batsman_career: {
      status: 'implemented',
      host: 'graphics_stage',
      componentId: 'theme1/batsman-career-card',
    },
    bowler_career: {
      status: 'implemented',
      host: 'score_strip',
      componentId: 'theme1/career-wrap',
    },
    innings_break: {
      status: 'implemented',
      host: 'graphics_stage',
      componentId: 'theme1/innings-scorecard',
    },
    toss_result: {
      status: 'implemented',
      host: 'graphics_stage',
      componentId: 'theme1/toss-result-card',
    },
    playing_xi: {
      status: 'implemented',
      host: 'graphics_stage',
      componentId: 'theme1/playing-xi-card',
    },
    leaderboard: {
      status: 'implemented',
      host: 'graphics_stage',
      componentId: 'theme1/leaderboard-card',
    },
    points_table: {
      status: 'implemented',
      host: 'graphics_stage',
      componentId: 'theme1/points-table-card',
    },
  },
};
