import { View } from 'react-native';

import { Text } from '../../ui/Text';

/** Native stub — YouTube embed is desktop web cockpit only. */
export function YouTubeLiveEmbed({
  youtubeUrl: _youtubeUrl,
}: {
  youtubeUrl: string | null | undefined;
}): React.ReactElement {
  return (
    <View className="flex-1 items-center justify-center px-3">
      <Text className="text-center font-sans text-[11px] text-text-inverse">
        YouTube Live preview is desktop web only.
      </Text>
    </View>
  );
}
