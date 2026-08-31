import { io, type Socket } from 'socket.io-client';

import {
  fetchBroadcastPlayerStats,
  ensureMatchContext,
  fetchMatchBallType,
  fetchMatchOverlayTheme,
  fetchScorecard,
} from './broadcast-fetch';
import { hasBowlerCareerStats } from './graphics-format';
import { isStripOwnedKind } from './graphics-stage';
import {
  DEFAULT_OVERLAY_THEME,
  resolveOverlayTheme,
} from './themes/registry';
import {
  LIVE_NAMESPACE,
  LiveEvent,
  type BallType,
  type BroadcastPlayerStatsView,
  type ConnectionStatus,
  type GraphicsCommandMessage,
  type LiveStateMessage,
  type LiveSubscribeMessage,
  type MatchContext,
  type ScorecardResponse,
} from './types';
import { deliveryProgressKey } from './view-model';

const DEFAULT_API_BASE = 'https://acc-api-production.up.railway.app';
const CAREER_ANIM_MS = 280;
/** Safety net if no ball is bowled while boundaries is flashing. */
const BOUNDARIES_FLASH_MS = 6000;

type StripCrrMode = 'default' | 'toss' | 'chase' | 'boundaries';

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) {
    throw new Error(`Missing #${id}`);
  }
  return node as T;
}

function queryParams(): { matchId: string | null; apiBase: string } {
  const params = new URLSearchParams(window.location.search);
  const matchId = params.get('matchId')?.trim() || null;
  const apiRaw = params.get('api')?.trim() || params.get('apiBase')?.trim();
  const apiBase = (apiRaw || DEFAULT_API_BASE).replace(/\/$/, '');
  return { matchId, apiBase };
}

async function start(): Promise<void> {
  const { matchId, apiBase } = queryParams();
  const root = document.getElementById('root');
  if (!root) {
    throw new Error('Missing #root');
  }

  let themeKey = DEFAULT_OVERLAY_THEME;
  if (matchId) {
    themeKey = await fetchMatchOverlayTheme(apiBase, matchId);
  }
  const theme = resolveOverlayTheme(themeKey);
  theme.loadStyles();
  theme.injectPageMarkup(root);
  document.title = `ASC Live Overlay — ${theme.label}`;

  let latest: ScorecardResponse | null = null;
  let matchCtx: MatchContext | null = null;
  let status: ConnectionStatus = 'connecting';
  let crrMode: StripCrrMode = 'default';
  let ballType: BallType = 'TENNIS';
  let careerOnAir = false;
  let inningsBreakOnAir = false;
  let careerPlayerId: string | null = null;
  let careerBase: BroadcastPlayerStatsView | null = null;
  let careerToken = 0;
  let boundariesArmedKey: string | null = null;
  let boundariesTimer: number | null = null;
  let tossArmedKey: string | null = null;
  let socket: Socket | null = null;

  const scoreStrip = theme.createScoreStripHost();
  const graphicsStage = theme.createGraphicsStage(el('graphics-stage'), {
    apiBase,
    matchId,
    injectMarkup: true,
  });

  const clearBoundariesFlash = (): void => {
    boundariesArmedKey = null;
    if (boundariesTimer != null) {
      window.clearTimeout(boundariesTimer);
      boundariesTimer = null;
    }
    if (crrMode === 'boundaries') {
      crrMode = 'default';
    }
  };

  const armBoundariesFlash = (): void => {
    crrMode = 'boundaries';
    boundariesArmedKey = deliveryProgressKey(latest);
    if (boundariesTimer != null) {
      window.clearTimeout(boundariesTimer);
    }
    boundariesTimer = window.setTimeout(() => {
      boundariesTimer = null;
      if (crrMode === 'boundaries') {
        clearBoundariesFlash();
        paint();
      }
    }, BOUNDARIES_FLASH_MS);
  };

  const maybeClearBoundariesOnDelivery = (card: ScorecardResponse): void => {
    if (crrMode !== 'boundaries' || boundariesArmedKey == null) {
      return;
    }
    const nextKey = deliveryProgressKey(card);
    if (nextKey !== boundariesArmedKey) {
      clearBoundariesFlash();
    }
  };

  const clearTossOnAir = (): void => {
    tossArmedKey = null;
    if (crrMode === 'toss') {
      crrMode = 'default';
    }
  };

  const maybeClearTossOnDelivery = (card: ScorecardResponse): void => {
    if (crrMode !== 'toss' || tossArmedKey == null) {
      return;
    }
    const nextKey = deliveryProgressKey(card);
    if (nextKey !== tossArmedKey) {
      clearTossOnAir();
    }
  };

  const paintCareerNumbers = (): void => {
    if (!careerOnAir || !careerPlayerId || !careerBase) {
      return;
    }
    scoreStrip.fillCareerCard(careerPlayerId, latest, careerBase);
  };

  const hideCareerCard = (): void => {
    careerOnAir = false;
    careerPlayerId = null;
    careerBase = null;
    scoreStrip.hideCareerCard(() => {
      if (!careerOnAir) {
        scoreStrip.careerWrapElement().hidden = true;
      }
    }, CAREER_ANIM_MS);
  };

  const showCareerCard = async (playerId: string): Promise<void> => {
    try {
      graphicsStage.hideAll();
      const token = ++careerToken;
      const stats = await fetchBroadcastPlayerStats(apiBase, playerId, ballType);
      if (token !== careerToken) {
        return;
      }
      if (!hasBowlerCareerStats(stats) || !stats) {
        hideCareerCard();
        paint();
        return;
      }
      careerBase = stats;
      careerPlayerId = playerId;
      scoreStrip.fillCareerCard(playerId, latest, stats);
      careerOnAir = true;
      scoreStrip.revealCareerCard();
      paint();
    } catch (err) {
      console.warn('[overlay graphics] show bowler career failed', err);
      hideCareerCard();
      paint();
    }
  };

  const paint = (): void => {
    scoreStrip.render({
      card: latest,
      ctx: matchCtx,
      status,
      missingMatchId: !matchId,
      crrMode,
      hideStrip: inningsBreakOnAir,
    });
    if (careerOnAir) {
      paintCareerNumbers();
    }
  };

  paint();

  if (!matchId) {
    return;
  }

  void (async () => {
    const [seed, ctx, bt] = await Promise.all([
      fetchScorecard(apiBase, matchId),
      ensureMatchContext(apiBase, matchId),
      fetchMatchBallType(apiBase, matchId),
    ]);
    ballType = bt;
    graphicsStage.setBallType(bt);
    if (ctx) {
      matchCtx = ctx;
      graphicsStage.setMatchContext(ctx);
    }
    if (seed) {
      latest = seed;
      graphicsStage.setScorecard(seed);
    }
    paint();
  })();

  socket = io(`${apiBase}${LIVE_NAMESPACE}`, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
    forceNew: true,
  });

  const subscribe = (): void => {
    const msg: LiveSubscribeMessage = { matchId };
    socket?.emit(LiveEvent.Subscribe, msg);
  };

  socket.on('connect', () => {
    status = 'live';
    subscribe();
    paint();
  });

  socket.on('disconnect', () => {
    status = 'offline';
    paint();
  });

  socket.on('connect_error', () => {
    status = 'offline';
    paint();
  });

  socket.io.on('reconnect', () => {
    status = 'live';
    subscribe();
    paint();
  });

  socket.on(LiveEvent.State, (frame: LiveStateMessage) => {
    if (frame.matchId !== matchId || !frame.state) {
      return;
    }
    if (
      latest &&
      latest.version === frame.state.version &&
      latest.matchId === frame.state.matchId
    ) {
      return;
    }
    latest = frame.state;
    maybeClearBoundariesOnDelivery(frame.state);
    maybeClearTossOnDelivery(frame.state);
    graphicsStage.setScorecard(frame.state);
    paint();
  });

  socket.on(LiveEvent.GraphicsCommand, (cmd: GraphicsCommandMessage) => {
    try {
      if (cmd.matchId !== matchId) {
        return;
      }
      if (cmd.action === 'hide_all') {
        clearBoundariesFlash();
        clearTossOnAir();
        crrMode = 'default';
        inningsBreakOnAir = false;
        hideCareerCard();
        graphicsStage.hideAll();
        paint();
        return;
      }
      if (cmd.graphic === 'bowler_career') {
        inningsBreakOnAir = false;
        if (cmd.action === 'show') {
          graphicsStage.hideAll();
          const playerId = cmd.payload?.playerId?.trim() || null;
          if (playerId) {
            void showCareerCard(playerId);
          }
        } else if (cmd.action === 'hide') {
          hideCareerCard();
          paint();
        }
        return;
      }
      if (cmd.graphic === 'toss') {
        if (cmd.action === 'show') {
          crrMode = 'toss';
          tossArmedKey = deliveryProgressKey(latest);
        } else if (cmd.action === 'hide' && crrMode === 'toss') {
          clearTossOnAir();
        }
        paint();
        return;
      }
      if (cmd.graphic === 'chase') {
        if (cmd.action === 'show') {
          crrMode = 'chase';
        } else if (cmd.action === 'hide' && crrMode === 'chase') {
          crrMode = 'default';
        }
        paint();
        return;
      }
      if (cmd.graphic === 'boundaries') {
        if (cmd.action === 'show') {
          armBoundariesFlash();
          paint();
        } else if (cmd.action === 'hide') {
          clearBoundariesFlash();
          paint();
        }
        return;
      }
      if (cmd.graphic && !isStripOwnedKind(cmd.graphic)) {
        if (cmd.action === 'show' && careerOnAir) {
          hideCareerCard();
        }
        inningsBreakOnAir = cmd.action === 'show' && cmd.graphic === 'innings_break';
        graphicsStage.applyCommand(cmd);
        paint();
      }
    } catch (err) {
      console.warn('[overlay graphics] command handler failed', err);
      try {
        graphicsStage.hideAll();
      } catch {
        /* ignore */
      }
    }
  });

  window.addEventListener('beforeunload', () => {
    if (socket) {
      socket.emit(LiveEvent.Unsubscribe, { matchId } satisfies LiveSubscribeMessage);
      socket.removeAllListeners();
      socket.disconnect();
      socket = null;
    }
  });
}

void start();
