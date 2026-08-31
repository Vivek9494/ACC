import { parseYoutubeVideoId, youtubeEmbedUrl } from '@acc/types';
import { createElement } from 'react';
import { View } from 'react-native';

import { Text } from '../../ui/Text';

/** Web: YouTube Live iframe embed for the cockpit Main Scoreboard monitor. */
export function YouTubeLiveEmbed({
  youtubeUrl,
}: {
  youtubeUrl: string | null | undefined;
}): React.ReactElement {
  const trimmed = youtubeUrl?.trim() ?? '';
  const videoId = trimmed.length > 0 ? parseYoutubeVideoId(trimmed) : null;

  if (!videoId) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-center font-sans text-xs text-text-inverse/80">
          Add a YouTube Live URL in Settings to preview the stream
        </Text>
        <Text className="mt-2 text-center font-sans text-[10px] text-text-inverse/50">
          ~10–30s behind live scoring (broadcast delay)
        </Text>
      </View>
    );
  }

  const embedSrc = youtubeEmbedUrl(videoId, { autoplay: true, mute: true });

  return (
    <View className="relative flex-1 bg-black" style={{ flex: 1, minHeight: 0 }}>
      {createElement('iframe', {
        src: embedSrc,
        title: 'YouTube Live stream',
        allow:
          'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
        allowFullScreen: true,
        style: {
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          border: 'none',
        },
      })}
    </View>
  );
}
