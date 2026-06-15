import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '../../../src/components/ui/Text';
import { FIELD_ORANGE } from '../../../src/components/ui/fieldStyles';

/**
 * Placeholder for match scheduling (later phase).
 *
 * TODO(match-scheduler): The scheduler must:
 * - Only allow scheduling on the tournament's stored match dates (see tournament.dates).
 * - Capture overs-per-innings at match setup (not on tournament create).
 * - For ACC tournaments, tie matches to ground geofence locations.
 */
export default function ScheduleMatchesPlaceholderScreen(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full active:bg-black/5"
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={FIELD_ORANGE} />
        </Pressable>
        <Text className="font-sans-bold text-lg text-on-surface">Schedule Matches</Text>
      </View>
      <ScrollView contentContainerClassName="flex-1 items-center justify-center px-6 pb-12">
        <Text className="text-center font-sans text-base text-on-surface-variant">
          Match scheduling is coming in a later phase.
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
