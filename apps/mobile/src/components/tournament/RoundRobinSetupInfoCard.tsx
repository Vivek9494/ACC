import type { RoundRobinMatchSetupContext } from '@acc/types';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { FIELD_ORANGE, INPUT_SHADOW_STYLE } from '../ui/fieldStyles';
import { Text } from '../ui/Text';

export interface RoundRobinSetupInfoCardProps {
  context: RoundRobinMatchSetupContext;
}

/** Round-robin Match Setup footer card — fixture progress and current standings. */
export function RoundRobinSetupInfoCard({
  context,
}: RoundRobinSetupInfoCardProps): React.ReactElement {
  const anyPoints = context.standings.some((row) => row.points > 0);

  return (
    <View
      className="gap-4 rounded-control border border-outline-variant bg-surface p-4"
      style={INPUT_SHADOW_STYLE}
    >
      <View className="gap-2">
        <Text className="font-sans-bold text-base text-on-surface">Round Robin Format</Text>
        <Text className="font-sans text-sm text-on-surface-variant">
          You are scheduling Match #{context.nextMatchNumber} of the tournament. Each team will
          play against every other team once.
        </Text>
      </View>

      <View className="gap-3 rounded-control bg-primary-container p-4">
        <View className="flex-row items-center gap-2">
          <Ionicons name="information-circle-outline" size={18} color={FIELD_ORANGE} />
          <Text className="font-sans-semibold text-sm text-on-surface">Current Standings</Text>
        </View>
        {context.standings.length === 0 ? (
          <Text className="font-sans text-sm text-on-surface-variant">No teams in this tournament yet.</Text>
        ) : anyPoints ? (
          context.standings.map((row) => (
            <Text key={row.teamId} className="font-sans text-sm text-on-surface">
              {row.teamName}{' '}
              <Text className="font-sans-semibold text-primary">{row.points} pts</Text>
            </Text>
          ))
        ) : (
          <>
            <Text className="font-sans text-sm text-on-surface-variant">
              No matches played yet.
            </Text>
            {context.standings.map((row) => (
              <Text key={row.teamId} className="font-sans text-sm text-on-surface-variant">
                {row.teamName} 0 pts
              </Text>
            ))}
          </>
        )}
      </View>
    </View>
  );
}
