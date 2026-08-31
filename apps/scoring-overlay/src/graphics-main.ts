import {
  ensureMatchContext,
  fetchMatchBallType,
  fetchMatchOverlayTheme,
  fetchScorecard,
} from './broadcast-fetch';
import {
  connectLiveSocket,
  queryApiAndMatch,
} from './live-client';
import {
  DEFAULT_OVERLAY_THEME,
  resolveOverlayTheme,
} from './themes/registry';

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) {
    throw new Error(`Missing #${id}`);
  }
  return node as T;
}

async function start(): Promise<void> {
  const { matchId, apiBase } = queryApiAndMatch();
  const stageRoot = el<HTMLDivElement>('stage');
  const status = el<HTMLDivElement>('status');

  let themeKey = DEFAULT_OVERLAY_THEME;
  if (matchId) {
    themeKey = await fetchMatchOverlayTheme(apiBase, matchId);
  }
  const theme = resolveOverlayTheme(themeKey);
  theme.loadStyles();

  const statusNode = status;
  stageRoot.innerHTML = '';
  const stage = theme.createGraphicsStage(stageRoot, {
    apiBase,
    matchId,
    injectMarkup: true,
  });
  stageRoot.appendChild(statusNode);

  if (!matchId) {
    status.hidden = false;
    status.textContent = 'Add ?matchId=…';
    return;
  }

  status.hidden = false;
  status.textContent = `Connecting to ${apiBase}…`;

  void (async () => {
    const [seed, ctx, bt] = await Promise.all([
      fetchScorecard(apiBase, matchId),
      ensureMatchContext(apiBase, matchId),
      fetchMatchBallType(apiBase, matchId),
    ]);
    if (seed) {
      stage.setScorecard(seed);
    }
    stage.setMatchContext(ctx);
    stage.setBallType(bt);
  })();

  connectLiveSocket(apiBase, matchId, {
    onStatus: (s) => {
      if (s === 'live') {
        status.hidden = true;
        return;
      }
      status.hidden = false;
      status.textContent =
        s === 'connecting' ? `Connecting to ${apiBase}…` : `Reconnecting (${apiBase})…`;
    },
    onLiveState: (state) => {
      stage.setScorecard(state);
    },
    onGraphicsCommand: (cmd) => {
      stage.applyCommand(cmd);
    },
  });
}

void start();
