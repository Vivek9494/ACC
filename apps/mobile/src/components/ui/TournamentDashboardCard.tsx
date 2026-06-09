import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, View } from 'react-native';
import { BallType, type TournamentSummary } from '@acc/types';

import {
  formatTournamentDateRange,
  tournamentLocation,
  tournamentStatusPill,
} from '../../lib/tournament-display';
import { Card } from './Card';
import { StatusPill } from './StatusPill';
import { Text } from './Text';

export interface TournamentDashboardCardProps {
  tournament: TournamentSummary;
  onPress?: () => void;
  onOverflowPress?: () => void;
}

export function TournamentDashboardCard({
  tournament,
  onPress,
  onOverflowPress,
}: TournamentDashboardCardProps): React.ReactElement {
  const pill = tournamentStatusPill(tournament.state);
  const ballIcon =
    tournament.ballType === BallType.Tennis ? 'tennisball-outline' : 'baseball-outline';

  return (
    <Card className="overflow-hidden p-0" onPress={onPress}>
      <View className="relative h-36 bg-surface-container-high">
        {tournament.posterUrl ? (
          <Image source={{ uri: tournament.posterUrl }} className="h-full w-full" resizeMode="cover" />
        ) : (
          <View className="h-full w-full items-center justify-center bg-surface-container-high">
            <Text className="font-sans-bold text-4xl text-on-surface-variant">
              {tournament.name.slice(0, 1).toUpperCase()}
            </Text>
          </View>
        )}
        <View className="absolute right-3 top-3">
          <StatusPill variant={pill.variant} label={pill.label} />
        </View>
      </View>

      <View className="gap-3 p-4">
        <View className="flex-row items-start justify-between gap-2">
          <Text className="flex-1 font-sans-bold text-lg text-on-surface" numberOfLines={2}>
            {tournament.name}
          </Text>
          <Pressable
            onPress={onOverflowPress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="More options"
          >
            <Ionicons name="ellipsis-vertical" size={20} color="#5a4136" />
          </Pressable>
        </View>

        <View className="flex-row items-center gap-2">
          <Ionicons name="location-outline" size={16} color="#5a4136" />
          <Text className="flex-1 font-sans text-sm text-on-surface-variant" numberOfLines={1}>
            {tournamentLocation(tournament)}
          </Text>
        </View>

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Ionicons name="calendar-outline" size={16} color="#5a4136" />
            <Text className="font-sans text-sm text-on-surface-variant">
              {formatTournamentDateRange(tournament.startAt, tournament.endAt)}
            </Text>
          </View>
          <Ionicons name={ballIcon} size={18} color="#a04100" />
        </View>
      </View>
    </Card>
  );
}
