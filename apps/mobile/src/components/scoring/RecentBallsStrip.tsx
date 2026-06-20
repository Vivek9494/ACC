import type { TimelineEntry } from '@acc/types';
import { View } from 'react-native';

import { recentBallChipStyle } from './liveScoringKeypadTokens';
import { Text } from '../ui/Text';

const RECENT_BALLS_COUNT = 7;

export interface RecentBallsStripProps {
  timeline: TimelineEntry[];
  compact?: boolean;
  /** When false, omit the "Recent balls" caption (score header uses chips only). */
  showLabel?: boolean;
}

function RecentBallChip({
  entry,
  compact,
}: {
  entry: TimelineEntry;
  compact: boolean;
}): React.ReactElement {
  const chip = recentBallChipStyle(entry.code, entry.isWicket);
  const size = compact ? 'h-8 min-w-8' : 'h-10 min-w-10';
  const textSize =
    chip.label.length > 3 ? 'text-[9px]' : chip.label.length > 2 ? 'text-[10px]' : 'text-xs';

  return (
    <View
      className={`${size} items-center justify-center rounded-full px-1.5 ${chip.bgClass}`}
    >
      <Text className={`font-sans-bold ${textSize} ${chip.textClass}`}>{chip.label}</Text>
    </View>
  );
}

/** Last {@link RECENT_BALLS_COUNT} deliveries as color-coded chips (oldest → newest, left → right). */
export function RecentBallsStrip({
  timeline,
  compact = false,
  showLabel = true,
}: RecentBallsStripProps): React.ReactElement | null {
  if (timeline.length === 0) {
    return null;
  }

  const recent = timeline.slice(-RECENT_BALLS_COUNT);

  return (
    <View className={compact ? 'gap-1' : 'gap-1.5'}>
      {showLabel ? (
        <Text className="font-sans-semibold text-[10px] uppercase tracking-wider text-on-surface-variant">
          Recent balls
        </Text>
      ) : null}
      <View className="flex-row flex-wrap gap-1.5">
        {recent.map((entry) => (
          <RecentBallChip key={entry.sequence} entry={entry} compact={compact} />
        ))}
      </View>
    </View>
  );
}
