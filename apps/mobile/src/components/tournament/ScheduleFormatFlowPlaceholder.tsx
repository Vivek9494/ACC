import { Ionicons } from '@expo/vector-icons';
import {
  MATCH_SCHEDULING_FORMAT_LABELS,
  type MatchSchedulingFormat,
} from '@acc/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '../ui/Text';
import { FIELD_ORANGE } from '../ui/fieldStyles';

export interface ScheduleFormatFlowPlaceholderProps {
  schedulingFormat: MatchSchedulingFormat;
}

/**
 * Placeholder for a format-specific scheduling flow (later phase).
 *
 * TODO(match-scheduler): fixture creation must only allow dates on tournament.dates,
 * capture overs-per-innings at match setup, and tie ACC matches to ground geofences.
 */
export function ScheduleFormatFlowPlaceholder({
  schedulingFormat,
}: ScheduleFormatFlowPlaceholderProps): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const label = MATCH_SCHEDULING_FORMAT_LABELS[schedulingFormat];

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full active:bg-black/5"
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={FIELD_ORANGE} />
        </Pressable>
        <Text className="font-sans-bold text-lg text-on-surface">{label}</Text>
      </View>
      <ScrollView contentContainerClassName="flex-1 items-center justify-center px-6 pb-12">
        <Text className="text-center font-sans text-base text-on-surface-variant">
          {label} scheduling is coming in a later phase.
        </Text>
        <Text className="mt-3 text-center font-sans-semibold text-sm text-on-surface">
          Format: {label}
        </Text>
        <Text className="mt-1 text-center font-sans text-xs text-on-surface-variant">
          ({schedulingFormat})
        </Text>
        {id ? (
          <Text className="mt-2 text-center font-sans text-sm text-on-surface-variant">
            Tournament {id}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
