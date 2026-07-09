/**
 * Authenticated user notification socket. Connects to `/user` with the access
 * token and listens for scorer-assignment pushes (dashboard card refresh).
 */
import { USER_NAMESPACE, UserEvent } from '@acc/types';
import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

import { API_BASE_URL } from './api';
import { useAuth } from './auth-context';
import { loadAccessToken } from './session';

/** Refetch the dashboard when this user gains per-match scoring access mid-match. */
export function useUserScorerAssignedListener(onAssigned: () => void): void {
  const { status } = useAuth();
  const onAssignedRef = useRef(onAssigned);
  onAssignedRef.current = onAssigned;

  useEffect(() => {
    if (status !== 'authenticated') {
      return;
    }

    let socket: Socket | null = null;
    let cancelled = false;

    void loadAccessToken().then((token) => {
      if (cancelled || !token) {
        return;
      }

      socket = io(`${API_BASE_URL}${USER_NAMESPACE}`, {
        transports: ['websocket'],
        auth: { token },
        forceNew: true,
      });

      socket.on(UserEvent.ScorerAssigned, () => {
        onAssignedRef.current();
      });
      socket.on('connect_error', () => {
        if (__DEV__) {
          console.warn('[user-socket] connect_error — scorer push channel unavailable');
        }
      });
    });

    return () => {
      cancelled = true;
      socket?.removeAllListeners();
      socket?.disconnect();
    };
  }, [status]);
}
