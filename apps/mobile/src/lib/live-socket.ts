/**
 * Real-time live-score subscription (spec §29). Connects to the Socket.IO
 * `/live` namespace, joins a match room, and surfaces pushed
 * {@link ScorecardResponse} frames. Read-only and unauthenticated — works for
 * Guests (spec §2). The cached snapshot is delivered immediately on subscribe.
 */
import {
  LIVE_NAMESPACE,
  LiveEvent,
  type LiveScorerRevokedMessage,
  type LiveStateMessage,
  type LiveSubscribeMessage,
  type ScorecardResponse,
} from '@acc/types';
import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

import { API_BASE_URL } from './api';

export type LiveConnectionStatus = 'connecting' | 'live' | 'offline';

export interface UseLiveScoreResult {
  state: ScorecardResponse | null;
  status: LiveConnectionStatus;
}

/**
 * Subscribes to a match's live state. Returns the latest scorecard frame and a
 * coarse connection status for the "LIVE" indicator. `seed` lets a caller paint
 * an initial REST snapshot before the socket frame arrives.
 */
export function useLiveScore(
  matchId: string | undefined,
  seed: ScorecardResponse | null = null,
): UseLiveScoreResult {
  const [state, setState] = useState<ScorecardResponse | null>(seed);
  const [status, setStatus] = useState<LiveConnectionStatus>('connecting');
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!matchId) {
      return;
    }
    const socket = io(`${API_BASE_URL}${LIVE_NAMESPACE}`, {
      transports: ['websocket'],
      forceNew: true,
    });
    socketRef.current = socket;

    const subscribe = (): void => {
      const msg: LiveSubscribeMessage = { matchId };
      socket.emit(LiveEvent.Subscribe, msg);
    };

    socket.on('connect', () => {
      setStatus('live');
      subscribe();
    });
    socket.on('disconnect', () => setStatus('offline'));
    socket.io.on('reconnect', subscribe);
    socket.on(LiveEvent.State, (frame: LiveStateMessage) => {
      if (frame.matchId === matchId && frame.state) {
        setState(frame.state);
      }
    });

    return () => {
      const msg: LiveSubscribeMessage = { matchId };
      socket.emit(LiveEvent.Unsubscribe, msg);
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [matchId]);

  return { state, status };
}

/**
 * Listens for mid-match scorer revoke events on the match room. The outgoing
 * scorer's scoring screen subscribes so it can show the revoke dialog.
 */
export function useMatchScorerRevokeListener(
  matchId: string | undefined,
  userId: string | undefined,
  onRevoked: (reason?: LiveScorerRevokedMessage['reason']) => void,
): void {
  const onRevokedRef = useRef(onRevoked);
  onRevokedRef.current = onRevoked;

  useEffect(() => {
    if (!matchId || !userId) {
      return;
    }

    const socket = io(`${API_BASE_URL}${LIVE_NAMESPACE}`, {
      transports: ['websocket'],
      forceNew: true,
    });

    const subscribe = (): void => {
      const msg: LiveSubscribeMessage = { matchId };
      socket.emit(LiveEvent.Subscribe, msg);
    };

    socket.on('connect', subscribe);
    socket.io.on('reconnect', subscribe);
    socket.on(LiveEvent.ScorerRevoked, (frame: LiveScorerRevokedMessage) => {
      if (frame.matchId === matchId && frame.userId === userId) {
        onRevokedRef.current(frame.reason);
      }
    });

    return () => {
      const msg: LiveSubscribeMessage = { matchId };
      socket.emit(LiveEvent.Unsubscribe, msg);
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [matchId, userId]);
}
