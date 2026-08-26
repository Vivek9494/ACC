import type { SquadPlayerView } from '@acc/types';
import { View } from 'react-native';

import { Text } from '../../ui/Text';
import { CockpitPanel, CockpitStubSlot } from './CockpitPanel';

export function FieldingAnalysisPanel({
  bowlingXi,
  nameOf,
}: {
  bowlingXi: SquadPlayerView[];
  nameOf: (id: string | null) => string;
}): React.ReactElement {
  return (
    <CockpitPanel title="Fielding & Analysis">
      <View className="flex-1 gap-2">
        {bowlingXi.length === 0 ? (
          <Text className="font-sans text-[11px] text-on-surface-variant">
            Bowling XI not locked yet.
          </Text>
        ) : (
          <View className="flex-row flex-wrap gap-x-4">
            {bowlingXi.map((player, index) => (
              <Text
                key={player.userId}
                className="w-[46%] font-sans text-[11px] text-on-surface"
                numberOfLines={1}
              >
                {index + 1}. {nameOf(player.userId)}
              </Text>
            ))}
          </View>
        )}
        <CockpitStubSlot
          title="Wagon Wheel"
          note="Needs per-ball shot direction. Not captured yet."
        />
        <CockpitStubSlot
          title="Fielding Positions"
          note="Needs fielder placement data. Empty dock slot for now."
        />
      </View>
    </CockpitPanel>
  );
}
