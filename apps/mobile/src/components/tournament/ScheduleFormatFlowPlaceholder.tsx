import {
  MATCH_SCHEDULING_FORMAT_LABELS,
  type MatchSchedulingFormat,
} from '@acc/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '../ui/ScreenHeader';
import { Text } from '../ui/Text';

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
      <ScreenHeader title={label} onBack={() => router.back()} />
      <ScrollView contentContainerClassName="flex-1 items-center justify-center px-6 pb-12">
        <Text className="text-center font-sans text-base text-on-surface-variant">
          {label} scheduling is coming in a later phase.
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
