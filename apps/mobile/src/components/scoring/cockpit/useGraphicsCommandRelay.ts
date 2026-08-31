/**
 * Live socket relay for OBS graphics:command (same /live namespace as score push).
 * Pure forward — matches apps/scoring-overlay control page behavior.
 */
import {
  LIVE_NAMESPACE,
  LiveEvent,
  type GraphicsCommandMessage,
  type LiveSubscribeMessage,
} from '@acc/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

import { API_BASE_URL } from '../../../lib/api';
import type { LiveConnectionStatus } from '../../../lib/live-socket';

export function useGraphicsCommandRelay(matchId: string): {
  status: LiveConnectionStatus;
  emit: (cmd: Omit<GraphicsCommandMessage, 'matchId'>) => void;
  lastCommand: GraphicsCommandMessage | null;
} {
  const [status, setStatus] = useState<LiveConnectionStatus>('connecting');
  const [lastCommand, setLastCommand] = useState<GraphicsCommandMessage | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const skipEchoRef = useRef(false);

  useEffect(() => {
    const socket = io(`${API_BASE_URL}${LIVE_NAMESPACE}`, {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
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
    socket.on('connect_error', () => setStatus('offline'));
    socket.io.on('reconnect', () => {
      setStatus('live');
      subscribe();
    });
    socket.on(LiveEvent.GraphicsCommand, (cmd: GraphicsCommandMessage) => {
      if (cmd.matchId !== matchId) {
        return;
      }
      if (skipEchoRef.current) {
        skipEchoRef.current = false;
        return;
      }
      setLastCommand(cmd);
    });

    return () => {
      const msg: LiveSubscribeMessage = { matchId };
      socket.emit(LiveEvent.Unsubscribe, msg);
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [matchId]);

  const emit = useCallback(
    (cmd: Omit<GraphicsCommandMessage, 'matchId'>) => {
      const socket = socketRef.current;
      if (!socket?.connected) {
        return;
      }
      // Skip the room echo for this emit — local UI already updated optimistically.
      skipEchoRef.current = true;
      const frame: GraphicsCommandMessage = { matchId, ...cmd };
      socket.emit(LiveEvent.GraphicsCommand, frame);
    },
    [matchId],
  );

  return { status, emit, lastCommand };
}
