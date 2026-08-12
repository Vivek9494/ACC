import {
  fetchMatchBallType,
  fetchScorecard,
} from './broadcast-fetch';
import {
  connectLiveSocket,
  queryApiAndMatch,
} from './live-client';
import { createGraphicsStage } from './graphics-stage';

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) {
    throw new Error(`Missing #${id}`);
  }
  return node as T;
}

function start(): void {
  const { matchId, apiBase } = queryApiAndMatch();
  const stageRoot = el<HTMLDivElement>('stage');
  const status = el<HTMLDivElement>('status');

  // Keep status outside injected markup.
  const statusNode = status;
  stageRoot.innerHTML = '';
  const stage = createGraphicsStage(stageRoot, {
    apiBase,
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
    const [seed, bt] = await Promise.all([
      fetchScorecard(apiBase, matchId),
      fetchMatchBallType(apiBase, matchId),
    ]);
    if (seed) {
      stage.setScorecard(seed);
    }
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

start();
