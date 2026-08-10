import { io, type Socket } from 'socket.io-client';

import { fetchMatchContext, fetchScorecard } from './broadcast-fetch';
import './style.css';
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
import {
  buildStripViewModel,
  formatRunsToWinLine,
  formatTossLine,
  type StripViewModel,
} from './view-model';

const DEFAULT_API_BASE = 'https://acc-api-production.up.railway.app';

/** Operator override for the CRR row (one at a time). */
type StripCrrMode = 'default' | 'toss' | 'chase';

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

function setText(id: string, text: string): void {
  const node = el(id);
  if (node.textContent !== text) {
    node.textContent = text;
  }
}

function setLogo(
  initialsId: string,
  imgId: string,
  initials: string,
  logoUrl: string | null,
): void {
  const initialsEl = el<HTMLSpanElement>(initialsId);
  const img = el<HTMLImageElement>(imgId);
  initialsEl.textContent = initials;
  if (logoUrl) {
    img.onload = () => {
      img.hidden = false;
      initialsEl.hidden = true;
    };
    img.onerror = () => {
      img.hidden = true;
      initialsEl.hidden = false;
      img.removeAttribute('src');
    };
    if (img.getAttribute('src') !== logoUrl) {
      img.hidden = true;
      initialsEl.hidden = false;
      img.src = logoUrl;
    }
  } else {
    img.hidden = true;
    initialsEl.hidden = false;
    img.removeAttribute('src');
  }
}

function renderOverTracker(vm: StripViewModel): void {
  const tracker = el<HTMLDivElement>('over-tracker');

  tracker.replaceChildren();
  for (const slot of vm.overTracker.slots) {
    const node = document.createElement('span');
    node.className = 'ball-slot';
    if (slot.isExtra) {
      node.classList.add('is-extra');
      node.textContent = slot.label;
    } else if (slot.label === '●') {
      node.classList.add('is-dot');
      node.textContent = '●';
    } else {
      if (slot.isWicket) {
        node.classList.add('is-wicket');
      }
      if (slot.isBoundary) {
        node.classList.add('is-boundary');
      }
      node.textContent = slot.label;
    }
    tracker.appendChild(node);
  }
  tracker.hidden = vm.overTracker.slots.length === 0;
}

function renderBatters(vm: StripViewModel): void {
  for (let i = 0; i < 2; i += 1) {
    const batter = vm.batsmen[i] ?? {
      name: '—',
      runs: '',
      balls: '',
      onStrike: false,
    };
    const row = el<HTMLDivElement>(`batter-${i}`);
    row.classList.toggle('is-strike', batter.onStrike);
    setText(`batter-${i}-name`, batter.name);
    setText(`batter-${i}-runs`, batter.runs);
    setText(`batter-${i}-balls`, batter.balls);
  }
}

function setCrrOverrideLine(text: string): void {
  const crrRow = el<HTMLDivElement>('crr-row');
  const runRate = el<HTMLSpanElement>('run-rate');
  const oversRem = el<HTMLSpanElement>('overs-rem');
  const crrSep = el<HTMLSpanElement>('crr-sep');
  crrRow.classList.add('is-override');
  runRate.classList.add('is-override-line');
  if (runRate.textContent !== text) {
    runRate.textContent = text;
  }
  oversRem.hidden = true;
  crrSep.hidden = true;
  oversRem.textContent = '';
}

function renderCrrRow(
  vm: StripViewModel,
  ctx: MatchContext | null,
  card: ScorecardResponse,
  crrMode: StripCrrMode,
): void {
  const crrRow = el<HTMLDivElement>('crr-row');
  const runRate = el<HTMLSpanElement>('run-rate');
  const oversRem = el<HTMLSpanElement>('overs-rem');
  const crrSep = el<HTMLSpanElement>('crr-sep');

  if (crrMode === 'toss') {
    const tossLine = formatTossLine(ctx);
    if (tossLine) {
      setCrrOverrideLine(tossLine);
      return;
    }
  }

  if (crrMode === 'chase') {
    const chaseLine = formatRunsToWinLine(card);
    if (chaseLine) {
      setCrrOverrideLine(chaseLine);
      return;
    }
  }

  crrRow.classList.remove('is-override');
  runRate.classList.remove('is-override-line');
  setText('run-rate', vm.runRateLine);
  if (vm.oversRemainingLine) {
    oversRem.hidden = false;
    crrSep.hidden = false;
    if (oversRem.textContent !== vm.oversRemainingLine) {
      oversRem.textContent = vm.oversRemainingLine;
    }
  } else {
    oversRem.hidden = true;
    crrSep.hidden = true;
    oversRem.textContent = '';
  }
}

function render(
  card: ScorecardResponse | null,
  ctx: MatchContext | null,
  status: ConnectionStatus,
  missingMatchId: boolean,
  crrMode: StripCrrMode,
): void {
  const wrap = el<HTMLDivElement>('strip-wrap');
  const idle = el<HTMLDivElement>('idle');
  const conn = el<HTMLDivElement>('conn');
  const subtitle = el<HTMLParagraphElement>('subtitle');
  const power = el<HTMLSpanElement>('power-pill');

  if (missingMatchId) {
    wrap.hidden = true;
    idle.hidden = false;
    idle.textContent = 'Add ?matchId=… to the overlay URL';
    return;
  }

  conn.hidden = status !== 'offline' && status !== 'connecting';
  conn.textContent = status === 'connecting' ? 'Connecting…' : 'Reconnecting…';

  if (!card) {
    if (wrap.hidden) {
      idle.hidden = false;
      idle.textContent = status === 'live' ? 'Waiting for live score…' : 'Connecting…';
    }
    return;
  }

  const vm = buildStripViewModel(card, ctx);
  if (!vm) {
    if (wrap.hidden) {
      idle.hidden = false;
      idle.textContent = 'Match ready — waiting for innings…';
    }
    return;
  }

  idle.hidden = true;
  wrap.hidden = false;

  setLogo('bat-initials', 'bat-logo', vm.batting.initials, vm.batting.logoUrl);
  setLogo('bowl-initials', 'bowl-logo', vm.bowling.initials, vm.bowling.logoUrl);
  renderBatters(vm);
  setText('score-line', vm.scoreLine);
  renderCrrRow(vm, ctx, card, crrMode);
  setText('overs-line', vm.oversLine);
  power.hidden = !vm.showPowerplay;

  // Avoid stacking the same chase/toss info under an overridden CRR row.
  let subtitleText = vm.subtitle;
  if (crrMode === 'chase') {
    subtitleText = null;
  } else if (crrMode === 'toss') {
    const tossLine = formatTossLine(ctx);
    if (tossLine && vm.subtitle === tossLine) {
      subtitleText = null;
    }
  }

  if (subtitleText) {
    subtitle.hidden = false;
    if (subtitle.textContent !== subtitleText) {
      subtitle.textContent = subtitleText;
    }
  } else {
    subtitle.hidden = true;
    subtitle.textContent = '';
  }

  setText('bowler-name', vm.bowlerName);
  setText('bowler-figs', vm.bowlerFigs);
  setText('bowler-overs', vm.bowlerOvers);
  renderOverTracker(vm);
}

function start(): void {
  const { matchId, apiBase } = queryParams();
  let latest: ScorecardResponse | null = null;
  let matchCtx: MatchContext | null = null;
  let status: ConnectionStatus = 'connecting';
  let crrMode: StripCrrMode = 'default';
  let socket: Socket | null = null;

  const paint = (): void => {
    render(latest, matchCtx, status, !matchId, crrMode);
  };

  paint();

  if (!matchId) {
    return;
  }

  void (async () => {
    const [seed, ctx] = await Promise.all([
      fetchScorecard(apiBase, matchId),
      fetchMatchContext(apiBase, matchId),
    ]);
    if (ctx) {
      matchCtx = ctx;
    }
    if (seed) {
      latest = seed;
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
    paint();
  });

  socket.on(LiveEvent.GraphicsCommand, (cmd: GraphicsCommandMessage) => {
    if (cmd.matchId !== matchId) {
      return;
    }
    if (cmd.action === 'hide_all') {
      crrMode = 'default';
      paint();
      return;
    }
    if (cmd.graphic === 'toss') {
      if (cmd.action === 'show') {
        crrMode = 'toss';
      } else if (cmd.action === 'hide' && crrMode === 'toss') {
        crrMode = 'default';
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

start();
