import type { SquadPlayerView } from '@acc/types';
import { View } from 'react-native';

import { Text } from '../../ui/Text';
import { CockpitPanel } from './CockpitPanel';

export function FieldingAnalysisPanel({
  bowlingXi,
  nameOf,
}: {
  bowlingXi: SquadPlayerView[];
  nameOf: (id: string | null) => string;
}): React.ReactElement {
  return (
    <CockpitPanel title="Fielding">
      <View className="flex-1">
        {bowlingXi.length === 0 ? (
          <Text className="font-sans text-[11px] text-on-surface-variant">
            Bowling XI not locked yet.
          </Text>
        ) : (
          <View className="gap-0.5">
            {bowlingXi.map((player, index) => (
              <Text
                key={player.userId}
                className="font-sans text-[11px] text-on-surface"
                numberOfLines={1}
              >
                {index + 1}. {nameOf(player.userId)}
              </Text>
            ))}
          </View>
        )}
      </View>
    </CockpitPanel>
  );
}
