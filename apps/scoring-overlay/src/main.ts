import { io, type Socket } from 'socket.io-client';

import {
  ensureMatchContext,
  fetchMatchBallType,
  fetchMatchOverlayTheme,
  fetchScorecard,
  fetchTournamentStats,
} from './broadcast-fetch';
import { isStripOwnedKind, type GraphicsStageController } from './graphics-stage';
import {
  DEFAULT_OVERLAY_THEME,
  resolveOverlayTheme,
} from './themes/registry';
import {
  LIVE_NAMESPACE,
  LiveEvent,
  type ConnectionStatus,
  type GraphicsCommandMessage,
  type LiveStateMessage,
  type LiveSubscribeMessage,
  type MatchContext,
  type ScorecardResponse,
} from './types';
import { deliveryProgressKey } from './view-model';

const DEFAULT_API_BASE = 'https://acc-api-production.up.railway.app';

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
  let inningsBreakOnAir = false;
  let tournamentBoundaries: { fours: number; sixes: number } | null = null;
  let boundariesFetchToken = 0;
  let tossArmedKey: string | null = null;
  let socket: Socket | null = null;

  const scoreStrip = theme.createScoreStripHost();
  /** No-op stage if factory fails — strip + live socket must still run. */
  const noopGraphicsStage: GraphicsStageController = {
    setScorecard() {},
    setMatchContext() {},
    setBallType() {},
    applyCommand() {},
    hideAll() {},
    isOnAir: () => false,
    activeKind: () => null,
  };
  let graphicsStage = noopGraphicsStage;
  try {
    graphicsStage = theme.createGraphicsStage(el('graphics-stage'), {
      apiBase,
      matchId,
      injectMarkup: true,
    });
  } catch (err) {
    console.warn(
      '[overlay] graphics stage failed to initialize — strip continues without full-screen graphics',
      err,
    );
  }

  const clearBoundariesOnAir = (): void => {
    boundariesFetchToken += 1;
    if (crrMode === 'boundaries') {
      crrMode = 'default';
    }
  };

  const showBoundariesOnAir = (): void => {
    crrMode = 'boundaries';
    const tid = matchCtx?.tournamentId?.trim() ?? '';
    if (!tid) {
      tournamentBoundaries = { fours: 0, sixes: 0 };
      return;
    }
    const token = ++boundariesFetchToken;
    void fetchTournamentStats(apiBase, tid).then((stats) => {
      if (token !== boundariesFetchToken) {
        return;
      }
      tournamentBoundaries = {
        fours: stats?.aggregates.fours ?? 0,
        sixes: stats?.aggregates.sixes ?? 0,
      };
      if (crrMode === 'boundaries') {
        paint();
      }
    });
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

  const paint = (): void => {
    scoreStrip.render({
      card: latest,
      ctx: matchCtx,
      status,
      missingMatchId: !matchId,
      crrMode,
      tournamentBoundaries,
      hideStrip: inningsBreakOnAir,
    });
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
        clearBoundariesOnAir();
        clearTossOnAir();
        crrMode = 'default';
        inningsBreakOnAir = false;
        graphicsStage.hideAll();
        paint();
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
          showBoundariesOnAir();
          paint();
        } else if (cmd.action === 'hide' && crrMode === 'boundaries') {
          clearBoundariesOnAir();
          paint();
        }
        return;
      }
      if (cmd.graphic && !isStripOwnedKind(cmd.graphic)) {
        inningsBreakOnAir =
          cmd.action === 'show' && cmd.graphic === 'innings_break';
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
      socket.emit(LiveEvent.Unsubscribe, {
        matchId,
      } satisfies LiveSubscribeMessage);
      socket.removeAllListeners();
      socket.disconnect();
      socket = null;
    }
  });
}

void start();
