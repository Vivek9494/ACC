import { View } from 'react-native';

import { Text } from '../../ui/Text';
import { overlayScoreboardUrl } from '../../../lib/overlay-url';
import { CockpitPanel } from './CockpitPanel';
import { OverlayIFrame } from './OverlayIFrame';

export function OverlayScoreboardPanel({ matchId }: { matchId: string }): React.ReactElement {
  const src = overlayScoreboardUrl(matchId);

  return (
    <CockpitPanel title="Main Scoreboard" live badge="reuses overlay" bodyNoPad bodyAbsolute>
      <View className="flex-1" style={{ flex: 1, minHeight: 0 }}>
        <View className="mx-2 mt-2 rounded border border-dashed border-secondary-200 bg-secondary-50 px-2.5 py-1.5">
          <Text className="font-sans text-xs text-secondary">
            Existing broadcast overlay page, bound to this match — not a rebuild.
          </Text>
        </View>
        <View className="min-h-0 flex-1 bg-secondary-900" style={{ flex: 1, minHeight: 0 }}>
          <OverlayIFrame src={src} />
        </View>
      </View>
    </CockpitPanel>
  );
}
