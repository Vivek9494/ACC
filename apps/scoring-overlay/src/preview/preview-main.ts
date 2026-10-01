/**
 * Overlay preview page (`/preview.html?preview=1&graphic=…&dataset=…`).
 * Renders one graphic from built-in sample data. Never opens the /live socket
 * and never calls the API, so it cannot affect a match or the OBS overlay.
 */

import {
  DEFAULT_OVERLAY_PREVIEW_DATASET,
  DEFAULT_OVERLAY_PREVIEW_GRAPHIC,
  isOverlayPreviewDataset,
  isOverlayPreviewGraphicKey,
  parseOverlayPreviewMessage,
  type OverlayPreviewDataset,
  type OverlayPreviewGraphicKey,
  type OverlayPreviewMessageType,
} from '@acc/types';

import { GRAPHIC_ANIM_MS } from '../graphic-visibility';
import { DEFAULT_OVERLAY_THEME, resolveOverlayTheme } from '../themes/registry';
import type { ScoreStripRenderParams } from '../themes/types';
import type { GraphicsCommandMessage, GraphicsKind, InningsBreakView } from '../types';
import { loadPreviewDataset, withBoundaryBall, type PreviewDataset } from './sample-data';

const PREVIEW_MATCH_ID = 'preview';
/** Matches score-strip BOWLER_SLOT_FLIP_MS plus a settle margin. */
const STRIP_FLIP_SETTLE_MS = 480;
const REPLAY_GAP_MS = GRAPHIC_ANIM_MS + 80;

const DASHBOARD_ORIGINS = new Set(
  [
    import.meta.env.VITE_DASHBOARD_ORIGIN?.trim() || 'https://acc-admin.netlify.app',
    ...(import.meta.env.DEV ? ['http://localhost:5180'] : []),
  ].map((origin) => origin.replace(/\/$/, '')),
);

type StripFace = ScoreStripRenderParams['crrMode'];

type PreviewPlan =
  | { kind: 'strip'; face: StripFace }
  | { kind: 'boundary'; runs: 4 | 6 }
  | {
      kind: 'stage';
      graphic: GraphicsKind;
      payload?: GraphicsCommandMessage['payload'];
      hidesStrip?: boolean;
    };

function inningsBreak(view: InningsBreakView): PreviewPlan {
  return { kind: 'stage', graphic: 'innings_break', payload: { view, source: 'break' }, hidesStrip: true };
}

function planFor(key: OverlayPreviewGraphicKey, ds: PreviewDataset): PreviewPlan {
  const featured = { inningsId: ds.featuredInningsId };
  switch (key) {
    case 'strip':
      return { kind: 'strip', face: 'default' };
    case 'strip_toss':
      return { kind: 'strip', face: 'toss' };
    case 'strip_chase':
      return { kind: 'strip', face: 'chase' };
    case 'strip_boundaries':
      return { kind: 'strip', face: 'boundaries' };
    case 'boundary_four':
      return { kind: 'boundary', runs: 4 };
    case 'boundary_six':
      return { kind: 'boundary', runs: 6 };
    case 'batsman':
    case 'bowler':
    case 'batsman_career':
    case 'bowler_career':
    case 'partnership':
    case 'toss_result':
    case 'points_table':
    case 'tournament_top_batsmen':
    case 'tournament_top_bowlers':
    case 'tournament_fours':
    case 'tournament_sixes':
    case 'most_fours':
    case 'most_sixes':
      return { kind: 'stage', graphic: key };
    case 'fow':
    case 'team_partnerships':
    case 'batting_card':
    case 'bowling_card':
      return { kind: 'stage', graphic: key, payload: featured };
    case 'playing_xi':
      return { kind: 'stage', graphic: 'playing_xi', payload: { variant: 'both' } };
    case 'playing_xi_single':
      return {
        kind: 'stage',
        graphic: 'playing_xi',
        payload: { variant: 'single', teamId: ds.featuredTeamId },
      };
    case 'playing_xi_lineup':
      return {
        kind: 'stage',
        graphic: 'playing_xi',
        payload: { variant: 'lineup', teamId: ds.featuredTeamId },
      };
    case 'innings_break_batting':
      return inningsBreak('batting');
    case 'innings_break_bowling':
      return inningsBreak('bowling');
    case 'innings_break_fow':
      return inningsBreak('fow');
    case 'innings_break_partnerships':
      return inningsBreak('partnerships');
    case 'innings_break_overs':
      return inningsBreak('overs');
  }
}

function readQuery(): { graphic: OverlayPreviewGraphicKey; dataset: OverlayPreviewDataset } {
  const params = new URLSearchParams(window.location.search);
  const graphic = params.get('graphic')?.trim() ?? '';
  const dataset = params.get('dataset')?.trim() ?? '';
  return {
    graphic: isOverlayPreviewGraphicKey(graphic) ? graphic : DEFAULT_OVERLAY_PREVIEW_GRAPHIC,
    dataset: isOverlayPreviewDataset(dataset) ? dataset : DEFAULT_OVERLAY_PREVIEW_DATASET,
  };
}

function start(): void {
  const root = document.getElementById('root');
  if (!root) {
    throw new Error('Missing #root');
  }
  const query = readQuery();
  const ds = loadPreviewDataset(query.dataset);
  const plan = planFor(query.graphic, ds);

  const theme = resolveOverlayTheme(DEFAULT_OVERLAY_THEME);
  theme.loadStyles();
  theme.injectPageMarkup(root);
  document.title = `ASC Overlay Preview — ${query.graphic}`;

  const stageRoot = document.getElementById('graphics-stage');
  if (!stageRoot) {
    throw new Error('Missing #graphics-stage');
  }
  const strip = theme.createScoreStripHost();
  const stage = theme.createGraphicsStage(stageRoot, {
    apiBase: '',
    matchId: null,
    injectMarkup: true,
    data: ds.data,
  });
  stage.setBallType(ds.ballType);
  stage.setMatchContext(ds.ctx);
  stage.setScorecard(ds.card);

  const boundaryCard = plan.kind === 'boundary' ? withBoundaryBall(ds.card, plan.runs) : null;
  let stripCard = ds.card;
  let crrMode: StripFace = 'default';
  let hideStrip = false;
  let generation = 0;

  const paint = (): void => {
    strip.render({
      card: stripCard,
      ctx: ds.ctx,
      status: 'live',
      missingMatchId: false,
      crrMode,
      hideStrip,
    });
  };

  const show = (): void => {
    if (plan.kind === 'strip') {
      hideStrip = false;
      crrMode = plan.face;
    } else if (plan.kind === 'boundary' && boundaryCard) {
      stripCard = boundaryCard;
      stage.setScorecard(null);
      stage.setScorecard(boundaryCard);
    } else if (plan.kind === 'stage') {
      hideStrip = plan.hidesStrip === true;
      stage.applyCommand({
        matchId: PREVIEW_MATCH_ID,
        action: 'show',
        graphic: plan.graphic,
        payload: plan.payload,
      });
    }
    paint();
  };

  const hide = (): void => {
    if (plan.kind === 'strip') {
      if (plan.face === 'default') {
        hideStrip = true;
      } else {
        crrMode = 'default';
      }
    } else if (plan.kind === 'boundary') {
      stage.hideAll();
      stripCard = ds.card;
      stage.setScorecard(ds.card);
    } else {
      stage.applyCommand({ matchId: PREVIEW_MATCH_ID, action: 'hide', graphic: plan.graphic });
      hideStrip = false;
    }
    paint();
  };

  const run = (type: OverlayPreviewMessageType): void => {
    generation += 1;
    const current = generation;
    if (type === 'show') {
      show();
      return;
    }
    hide();
    if (type === 'replay') {
      const gap = plan.kind === 'strip' && plan.face !== 'default' ? STRIP_FLIP_SETTLE_MS : REPLAY_GAP_MS;
      window.setTimeout(() => {
        if (current === generation) {
          show();
        }
      }, gap);
    }
  };

  window.addEventListener('message', (event: MessageEvent<unknown>) => {
    if (window.parent === window || event.source !== window.parent) {
      return;
    }
    if (!DASHBOARD_ORIGINS.has(event.origin)) {
      return;
    }
    const message = parseOverlayPreviewMessage(event.data);
    if (message) {
      run(message.type);
    }
  });

  paint();
  if (plan.kind === 'strip' && plan.face !== 'default') {
    window.setTimeout(() => run('show'), STRIP_FLIP_SETTLE_MS);
  } else {
    run('show');
  }
}

start();
