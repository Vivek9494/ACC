import { View } from 'react-native';

import { CockpitPanel } from './CockpitPanel';
import { OverlayIFrame } from './OverlayIFrame';

export function OverlayScoreboardPanel({ matchId }: { matchId: string }): React.ReactElement {
  return (
    <CockpitPanel title="Main Scoreboard" live badge="reuses overlay" bodyNoPad bodyAbsolute>
      <View className="min-h-0 flex-1 bg-secondary-900" style={{ flex: 1, minHeight: 0 }}>
        <OverlayIFrame matchId={matchId} />
      </View>
    </CockpitPanel>
  );
}
