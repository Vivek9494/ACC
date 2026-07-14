import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '../../../../src/components/ui/ScreenHeader';
import { Text } from '../../../../src/components/ui/Text';

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
    <SafeAreaView className="flex-1 bg-background">
      <ScreenHeader title="Schedule Matches" onBack={() => router.back()} />
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
