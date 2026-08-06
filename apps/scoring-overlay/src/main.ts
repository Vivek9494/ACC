import { io, type Socket } from 'socket.io-client';

import './style.css';
import {
  LIVE_NAMESPACE,
  LiveEvent,
  type ConnectionStatus,
  type LiveStateMessage,
  type LiveSubscribeMessage,
  type ScorecardResponse,
} from './types';
import { buildStripViewModel } from './view-model';

const DEFAULT_API_BASE = 'https://acc-api-production.up.railway.app';

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

async function fetchScorecard(
  apiBase: string,
  matchId: string,
): Promise<ScorecardResponse | null> {
  try {
    const res = await fetch(`${apiBase}/matches/${encodeURIComponent(matchId)}/scorecard`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as ScorecardResponse;
  } catch {
    return null;
  }
}

function setText(id: string, text: string): void {
  const node = el(id);
  if (node.textContent !== text) {
    node.textContent = text;
  }
}

function render(
  card: ScorecardResponse | null,
  status: ConnectionStatus,
  missingMatchId: boolean,
): void {
  const strip = el<HTMLDivElement>('strip');
  const idle = el<HTMLDivElement>('idle');
  const conn = el<HTMLDivElement>('conn');
  const chase = el<HTMLDivElement>('chase-block');

  if (missingMatchId) {
    strip.hidden = true;
    idle.hidden = false;
    idle.textContent = 'Add ?matchId=… to the overlay URL';
    return;
  }

  conn.hidden = status !== 'offline' && status !== 'connecting';
  conn.textContent = status === 'connecting' ? 'Connecting…' : 'Reconnecting…';

  if (!card) {
    // Keep strip hidden only until first state — never flash errors.
    if (strip.hidden) {
      idle.hidden = false;
      idle.textContent = status === 'live' ? 'Waiting for live score…' : 'Connecting…';
    }
    return;
  }

  const vm = buildStripViewModel(card);
  if (!vm) {
    if (strip.hidden) {
      idle.hidden = false;
      idle.textContent = 'Match ready — waiting for innings…';
    }
    return;
  }

  idle.hidden = true;
  strip.hidden = false;

  setText('team-name', vm.teamName);
  setText('score-line', vm.scoreLine);
  setText('overs-line', vm.oversLine);
  setText('striker', vm.striker);
  setText('non-striker', vm.nonStriker);
  setText('bowler', vm.bowler);

  const chaseText = vm.resultNote ?? vm.chase;
  if (chaseText) {
    chase.hidden = false;
    if (chase.textContent !== chaseText) {
      chase.textContent = chaseText;
    }
  } else {
    chase.hidden = true;
    chase.textContent = '';
  }
}

function start(): void {
  const { matchId, apiBase } = queryParams();
  let latest: ScorecardResponse | null = null;
  let status: ConnectionStatus = 'connecting';
  let socket: Socket | null = null;

  const paint = (): void => {
    render(latest, status, !matchId);
  };

  paint();

  if (!matchId) {
    return;
  }

  void (async () => {
    const seed = await fetchScorecard(apiBase, matchId);
    if (seed) {
      latest = seed;
      paint();
    }
  })();

  socket = io(`${apiBase}${LIVE_NAMESPACE}`, {
    transports: ['websocket'],
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
    // Avoid unnecessary work / flicker when version is unchanged.
    if (latest && latest.version === frame.state.version && latest.matchId === frame.state.matchId) {
      return;
    }
    latest = frame.state;
    paint();
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

start();
