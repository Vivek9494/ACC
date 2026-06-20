import type { ParticipationPollCardView } from '@acc/types';
import { MaterialIcons } from '@expo/vector-icons';
import { View } from 'react-native';
import { colors } from '@/theme/colors';

import { ParticipationPollSection } from './ParticipationPollSection';
import { Card } from '../ui/Card';
import { Text } from '../ui/Text';

export interface ParticipationPollCardProps {
  poll: ParticipationPollCardView;
  onPollUpdated: () => void;
}

/** Leather-ball "Are you playing?" dashboard card (§9.7). */
export function ParticipationPollCard({
  poll,
  onPollUpdated,
}: ParticipationPollCardProps): React.ReactElement {
  return (
    <Card accent className="gap-4 rounded-control">
      <View className="gap-1">
        <Text className="font-sans-bold text-xs uppercase tracking-wider text-primary">
          {poll.tournamentName}
        </Text>
        <View className="flex-row items-center gap-2">
          <MaterialIcons name="event" size={16} color={colors.textMuted} />
          <Text className="font-sans text-sm text-on-surface-variant">{poll.dateTimeLine}</Text>
        </View>
        {poll.venue ? (
          <View className="flex-row items-center gap-2">
            <MaterialIcons name="location-on" size={16} color={colors.textMuted} />
            <Text className="font-sans text-sm text-on-surface-variant" numberOfLines={2}>
              {poll.venue}
            </Text>
          </View>
        ) : null}
      </View>

      <Text className="font-sans-bold text-lg text-on-surface">{poll.matchTitle}</Text>

      <ParticipationPollSection poll={poll} onPollUpdated={onPollUpdated} />
    </Card>
  );
}
