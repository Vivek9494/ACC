import './control.css';
import {
  connectLiveSocket,
  emitGraphicsCommand,
  queryApiAndMatch,
  type GraphicsCommandMessage,
} from './live-client';
import type { Socket } from 'socket.io-client';

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) {
    throw new Error(`Missing #${id}`);
  }
  return node as T;
}

function start(): void {
  const { matchId, apiBase } = queryApiAndMatch();
  const matchLabel = el<HTMLParagraphElement>('match-label');
  const connLabel = el<HTMLParagraphElement>('conn-label');
  const onAir = el<HTMLParagraphElement>('on-air');

  if (!matchId) {
    matchLabel.textContent = 'Missing matchId — add ?matchId=… to the URL';
    connLabel.textContent = 'Offline';
    return;
  }

  const resolvedMatchId = matchId;
  matchLabel.textContent = `Match ${resolvedMatchId}`;
  connLabel.textContent = `Connecting to ${apiBase}…`;
  let socket: Socket | null = null;
  let onAirGraphic: string | null = null;

  function setOnAir(label: string | null): void {
    onAirGraphic = label;
    onAir.textContent = label ? `On air: ${label}` : 'On air: none';
    onAir.classList.toggle('is-live', label != null);
  }

  function send(cmd: Omit<GraphicsCommandMessage, 'matchId'>): void {
    if (!socket) {
      return;
    }
    emitGraphicsCommand(socket, { matchId: resolvedMatchId, ...cmd });
  }

  socket = connectLiveSocket(apiBase, resolvedMatchId, {
    onStatus: (s) => {
      if (s === 'live') {
        connLabel.textContent = `Live · ${apiBase}`;
        connLabel.className = 'conn-label status-live';
        return;
      }
      connLabel.textContent =
        s === 'connecting'
          ? `Connecting to ${apiBase}…`
          : `Offline — check API/CORS (${apiBase})`;
      connLabel.className = `conn-label status-${s}`;
    },
    onGraphicsCommand: (cmd) => {
      // Mirror room state so the panel reflects what graphics received
      // (including commands from another control tab).
      if (cmd.action === 'hide_all') {
        setOnAir(null);
        return;
      }
      if (cmd.graphic === 'hello') {
        if (cmd.action === 'show') {
          setOnAir('HELLO');
        } else if (cmd.action === 'hide' && onAirGraphic === 'HELLO') {
          setOnAir(null);
        }
      }
    },
  });

  el<HTMLButtonElement>('btn-show-hello').addEventListener('click', () => {
    send({ action: 'show', graphic: 'hello' });
  });
  el<HTMLButtonElement>('btn-hide-hello').addEventListener('click', () => {
    send({ action: 'hide', graphic: 'hello' });
  });
  el<HTMLButtonElement>('btn-hide-all').addEventListener('click', () => {
    send({ action: 'hide_all' });
  });
}

start();
