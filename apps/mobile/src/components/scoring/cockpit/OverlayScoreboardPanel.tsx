import { View } from 'react-native';

import { CockpitPanel } from './CockpitPanel';
import { YouTubeLiveEmbed } from './YouTubeLiveEmbed';

export function OverlayScoreboardPanel({
  youtubeUrl,
}: {
  youtubeUrl: string | null | undefined;
}): React.ReactElement {
  return (
    <CockpitPanel title="Main Scoreboard" live bodyNoPad bodyAbsolute>
      <View className="min-h-0 flex-1 bg-secondary-900" style={{ flex: 1, minHeight: 0 }}>
        <YouTubeLiveEmbed youtubeUrl={youtubeUrl} />
      </View>
    </CockpitPanel>
  );
}
