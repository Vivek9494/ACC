import type { PlayerSkillVideoPlaybackView, VerifiedRegisteredPlayerRow } from '@acc/types';
import { useCallback, useState } from 'react';

import { ApiRequestError, getPlayerSkillVideoPlayback } from '../lib/api';

export interface SkillVideoPlaybackState {
  visible: boolean;
  playerName: string;
  playback: PlayerSkillVideoPlaybackView | null;
  loading: boolean;
  error: string | null;
  openVideo: (player: VerifiedRegisteredPlayerRow) => void;
  closeVideo: () => void;
  retry: () => void;
}

/** Loads scouting playback URLs and drives {@link SkillVideoPlayerModal}. */
export function useSkillVideoPlayback(tournamentId: string | undefined): SkillVideoPlaybackState {
  const [visible, setVisible] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [playback, setPlayback] = useState<PlayerSkillVideoPlaybackView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPlayback = useCallback(
    async (userId: string) => {
      if (!tournamentId) {
        setError('Tournament not found.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      setPlayback(null);
      try {
        const data = await getPlayerSkillVideoPlayback(tournamentId, userId);
        setPlayback(data);
      } catch (err) {
        setPlayback(null);
        setError(
          err instanceof ApiRequestError
            ? err.message
            : 'Could not load the skill video. It may still be processing or unavailable.',
        );
      } finally {
        setLoading(false);
      }
    },
    [tournamentId],
  );

  const openVideo = useCallback(
    (player: VerifiedRegisteredPlayerRow) => {
      if (!player.hasSkillVideo) {
        return;
      }
      setPlayerName(`${player.firstName} ${player.lastName}`);
      setTargetUserId(player.userId);
      setVisible(true);
      void loadPlayback(player.userId);
    },
    [loadPlayback],
  );

  const closeVideo = useCallback(() => {
    setVisible(false);
    setTargetUserId(null);
    setPlayback(null);
    setError(null);
    setLoading(false);
  }, []);

  const retry = useCallback(() => {
    if (targetUserId) {
      void loadPlayback(targetUserId);
    }
  }, [loadPlayback, targetUserId]);

  return {
    visible,
    playerName,
    playback,
    loading,
    error,
    openVideo,
    closeVideo,
    retry,
  };
}
