import { type AvailabilitySummary } from '@acc/types';
import { View } from 'react-native';
import { Text } from './ui/Text';

interface Segment {
  label: string;
  count: number;
  bar: string;
}

/**
 * Horizontal availability bar-chart for the §7.5 organizer view: Available /
 * Unavailable / Pending across the confirmed players.
 */
export function AvailabilityBar({ summary }: { summary: AvailabilitySummary }): React.ReactElement {
  const segments: Segment[] = [
    { label: 'Available', count: summary.available, bar: 'bg-primary' },
    { label: 'Unavailable', count: summary.unavailable, bar: 'bg-secondary' },
    { label: 'Pending', count: summary.pending, bar: 'bg-stone-300' },
  ];
  const total = summary.total || 1;

  return (
    <View className="gap-3">
      <View className="h-4 flex-row overflow-hidden rounded-full bg-stone-200">
        {segments.map((segment) =>
          segment.count > 0 ? (
            <View
              key={segment.label}
              className={segment.bar}
              style={{ flex: segment.count / total }}
            />
          ) : null,
        )}
      </View>
      <View className="flex-row flex-wrap gap-x-5 gap-y-2">
        {segments.map((segment) => (
          <View key={segment.label} className="flex-row items-center gap-2">
            <View className={`h-3 w-3 rounded-full ${segment.bar}`} />
            <Text className="font-sans text-sm text-text">
              {segment.label} · {segment.count}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
