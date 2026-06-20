import type { PlayerSkillVideoPlaybackView } from '@acc/types';
import { Ionicons } from '@expo/vector-icons';
import { useEvent } from 'expo';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, View } from 'react-native';

import { Text } from '../ui/Text';
import { FIELD_ORANGE } from '../ui/fieldStyles';
import { colors } from '@/theme/colors';

export interface SkillVideoPlayerModalProps {
  visible: boolean;
  playerName: string;
  playback: PlayerSkillVideoPlaybackView | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onClose: () => void;
}

function SkillVideoPlayer({
  playback,
  onError,
}: {
  playback: PlayerSkillVideoPlaybackView;
  onError: (message: string) => void;
}): React.ReactElement {
  const player = useVideoPlayer(playback.playbackUrl, (instance) => {
    instance.loop = false;
    instance.play();
  });

  const { status } = useEvent(player, 'statusChange', { status: player.status });

  useEffect(() => {
    if (status === 'error') {
      onError('Could not load the skill video. It may still be processing or unavailable.');
    }
  }, [status, onError]);

  return (
    <VideoView
      player={player}
      style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.shadow }}
      nativeControls
      allowsFullscreen
      contentFit="contain"
    />
  );
}

/** Full-screen modal player for scouting skill videos (streams from storage URL). */
export function SkillVideoPlayerModal({
  visible,
  playerName,
  playback,
  loading,
  error,
  onRetry,
  onClose,
}: SkillVideoPlayerModalProps): React.ReactElement {
  const [playerError, setPlayerError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setPlayerError(null);
    }
  }, [visible, playback?.playbackUrl]);

  const handlePlayerError = useCallback((message: string) => {
    setPlayerError(message);
  }, []);

  const displayError = error ?? playerError;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-background">
        <View className="flex-row items-center justify-between border-b border-outline-variant px-4 py-3">
          <View className="min-w-0 flex-1 pr-3">
            <Text className="font-sans-bold text-lg text-on-surface" numberOfLines={1}>
              {playerName}
            </Text>
            <Text className="font-sans text-sm text-on-surface-variant">Skill video</Text>
          </View>
          <Pressable
            onPress={onClose}
            className="h-10 w-10 items-center justify-center rounded-full active:bg-black/5"
            accessibilityRole="button"
            accessibilityLabel="Close video player"
          >
            <Ionicons name="close" size={24} color={FIELD_ORANGE} />
          </Pressable>
        </View>

        <View className="flex-1 justify-center px-4 pb-8">
          {loading ? (
            <View className="items-center gap-3 py-16">
              <ActivityIndicator color={FIELD_ORANGE} size="large" />
              <Text className="font-sans text-sm text-on-surface-variant">Loading video…</Text>
            </View>
          ) : null}

          {!loading && displayError ? (
            <View className="items-center gap-4 px-4 py-16">
              <Ionicons name="alert-circle-outline" size={48} color={FIELD_ORANGE} />
              <Text className="text-center font-sans text-base text-on-surface">{displayError}</Text>
              <Pressable
                onPress={onRetry}
                className="rounded-full bg-primary px-6 py-3 active:opacity-80"
              >
                <Text className="font-sans-semibold text-sm text-on-primary">Retry</Text>
              </Pressable>
            </View>
          ) : null}

          {!loading && !displayError && playback ? (
            <SkillVideoPlayer playback={playback} onError={handlePlayerError} />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
