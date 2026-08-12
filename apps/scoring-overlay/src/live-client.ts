/**
 * Shared live Socket.IO helpers for strip / graphics / control pages.
 */

import { io, type Socket } from 'socket.io-client';

import type { LiveStateMessage, ScorecardResponse } from './types';

export const DEFAULT_API_BASE = 'https://acc-api-production.up.railway.app';

export const LIVE_NAMESPACE = '/live';

export const LiveEvent = {
  Subscribe: 'live:subscribe',
  Unsubscribe: 'live:unsubscribe',
  State: 'live:state',
  GraphicsCommand: 'graphics:command',
} as const;

export type GraphicsCommandAction = 'show' | 'hide' | 'hide_all';

export type GraphicsKind =
  | 'batsman'
  | 'bowler'
  | 'partnership'
  | 'fow'
  | 'innings_break'
  | 'toss'
  | 'chase'
  | 'bowler_career'
  | 'batsman_career'
  | 'toss_result'
  | 'hello';

export interface GraphicsCommandMessage {
  matchId: string;
  action: GraphicsCommandAction;
  graphic?: GraphicsKind;
  payload?: { playerId?: string; playerIds?: string[] };
}

export function queryApiAndMatch(): { matchId: string | null; apiBase: string } {
  const params = new URLSearchParams(window.location.search);
  const matchId = params.get('matchId')?.trim() || null;
  const apiRaw = params.get('api')?.trim() || params.get('apiBase')?.trim();
  const apiBase = normalizeApiBase(apiRaw || DEFAULT_API_BASE);
  return { matchId, apiBase };
}

/** Lowercase scheme/host so `HTTP://LOCALHOST:3001` still works. */
function normalizeApiBase(raw: string): string {
  const trimmed = raw.replace(/\/$/, '');
  try {
    const url = new URL(trimmed);
    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();
    return `${url.origin}${url.pathname}`.replace(/\/$/, '');
  } catch {
    return trimmed.toLowerCase();
  }
}

export function connectLiveSocket(
  apiBase: string,
  matchId: string,
  handlers: {
    onStatus?: (status: 'connecting' | 'live' | 'offline') => void;
    onGraphicsCommand?: (cmd: GraphicsCommandMessage) => void;
    onLiveState?: (state: ScorecardResponse | null) => void;
  } = {},
): Socket {
  const socket = io(`${apiBase}${LIVE_NAMESPACE}`, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
    forceNew: true,
  });

  const subscribe = (): void => {
    socket.emit(LiveEvent.Subscribe, { matchId });
  };

  handlers.onStatus?.('connecting');

  socket.on('connect', () => {
    handlers.onStatus?.('live');
    subscribe();
  });
  socket.on('disconnect', () => handlers.onStatus?.('offline'));
  socket.on('connect_error', () => handlers.onStatus?.('offline'));
  socket.io.on('reconnect', () => {
    handlers.onStatus?.('live');
    subscribe();
  });

  if (handlers.onLiveState) {
    socket.on(LiveEvent.State, (msg: LiveStateMessage) => {
      if (msg.matchId === matchId) {
        handlers.onLiveState?.(msg.state);
      }
    });
  }

  if (handlers.onGraphicsCommand) {
    socket.on(LiveEvent.GraphicsCommand, (cmd: GraphicsCommandMessage) => {
      if (cmd.matchId === matchId) {
        handlers.onGraphicsCommand?.(cmd);
      }
    });
  }

  window.addEventListener('beforeunload', () => {
    socket.emit(LiveEvent.Unsubscribe, { matchId });
    socket.removeAllListeners();
    socket.disconnect();
  });

  return socket;
}

export function emitGraphicsCommand(
  socket: Socket,
  cmd: GraphicsCommandMessage,
): void {
  socket.emit(LiveEvent.GraphicsCommand, cmd);
}
