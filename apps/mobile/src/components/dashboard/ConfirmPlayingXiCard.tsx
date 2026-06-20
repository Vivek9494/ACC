import type { CaptainPlayingXiCardView } from '@acc/types';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';
import { colors } from '@/theme/colors';

import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Text } from '../ui/Text';

export interface ConfirmPlayingXiCardProps {
  card: CaptainPlayingXiCardView;
}

/** Captain-only card to confirm Playing 11 after the participation poll closes (§9.7). */
export function ConfirmPlayingXiCard({ card }: ConfirmPlayingXiCardProps): React.ReactElement {
  const router = useRouter();

  return (
    <Card accent className="gap-4 rounded-control">
      <View className="gap-1">
        <Text className="font-sans-bold text-xs uppercase tracking-wider text-primary">
          {card.tournamentName}
        </Text>
        <View className="flex-row items-center gap-2">
          <MaterialIcons name="event" size={16} color={colors.textMuted} />
          <Text className="font-sans text-sm text-on-surface-variant">{card.dateTimeLine}</Text>
        </View>
        {card.venue ? (
          <View className="flex-row items-center gap-2">
            <MaterialIcons name="location-on" size={16} color={colors.textMuted} />
            <Text className="font-sans text-sm text-on-surface-variant" numberOfLines={2}>
              {card.venue}
            </Text>
          </View>
        ) : null}
      </View>

      <Text className="font-sans-bold text-lg text-on-surface">{card.matchTitle}</Text>

      <Button
        label={card.hasSavedSquad ? 'Edit Playing 11' : 'Confirm Playing 11'}
        onPress={() =>
          router.push(
            `/participation-polls/${card.pollId}/playing-xi` as Href,
          )
        }
        className="h-12 w-full"
      />
    </Card>
  );
}
