import type { CaptainPunchTimeCardView } from '@acc/types';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Text } from '../ui/Text';

export interface PunchTimeCardProps {
  card: CaptainPunchTimeCardView;
}

/** Captain-only card to open Punch Time attendance on match day. */
export function PunchTimeCard({ card }: PunchTimeCardProps): React.ReactElement {
  const router = useRouter();

  return (
    <Card accent className="gap-4 rounded-control">
      <View className="gap-1">
        <Text className="font-sans-bold text-xs uppercase tracking-wider text-primary">
          {card.tournamentName}
        </Text>
        <Text className="font-sans-bold text-lg text-on-surface">{card.matchTitle}</Text>
      </View>

      <View className="flex-row items-center justify-between">
        <View>
          <Text className="font-sans-bold text-3xl text-on-surface">
            {card.playersPresentCount}
          </Text>
          <Text className="font-sans text-sm text-on-surface-variant">Players Present</Text>
        </View>
        <View className="rounded-full bg-primary-container px-4 py-2">
          <Text className="font-sans-semibold text-sm text-primary">
            {card.aggregateStatusLabel}
          </Text>
        </View>
      </View>

      <Button
        label="Punch Time"
        onPress={() =>
          router.push(
            `/matches/${card.matchId}/punch-time?teamId=${encodeURIComponent(card.teamId)}`,
          )
        }
        className="h-12 w-full"
      />
    </Card>
  );
}
