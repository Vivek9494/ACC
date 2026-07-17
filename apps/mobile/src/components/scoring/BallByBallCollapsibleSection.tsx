import type { TimelineEntry } from '@acc/types';
import { MaterialIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { FIELD_ORANGE, INPUT_SHADOW_STYLE } from '../ui/fieldStyles';
import { Text } from '../ui/Text';
import { recentBallChipStyle } from './liveScoringKeypadTokens';
import { LIVE_SCORECARD_TYPE } from './liveScoringScorecardTypography';

function BallChip({ entry }: { entry: TimelineEntry }): React.ReactElement {
  const chip = recentBallChipStyle(entry.code, entry.isWicket);
  const textSize =
    chip.label.length > 3 ? 'text-xs' : chip.label.length > 2 ? 'text-sm' : 'text-sm';

  return (
    <View className={`h-9 min-w-9 items-center justify-center rounded-full px-1.5 ${chip.bgClass}`}>
      <Text className={`font-sans-bold ${textSize} ${chip.textClass}`}>{chip.label}</Text>
    </View>
  );
}

function groupTimelineEntriesByOver(
  timeline: TimelineEntry[],
): { overNumber: number; entries: TimelineEntry[] }[] {
  const map = new Map<number, TimelineEntry[]>();
  for (const entry of timeline) {
    if (entry.overNumber === null) {
      continue;
    }
    const list = map.get(entry.overNumber) ?? [];
    list.push(entry);
    map.set(entry.overNumber, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([overNumber, entries]) => ({ overNumber, entries }));
}

export interface BallByBallCollapsibleSectionProps {
  timeline: TimelineEntry[];
  /**
   * Visual chrome: `scorecard` matches public innings cards; `live` matches the
   * live-scoring Scorecard tab sections.
   */
  variant?: 'scorecard' | 'live';
}

/**
 * Per-over ball-by-ball breakdown in a collapsible card.
 * Only the heading toggles expand/collapse (content taps do not).
 */
export function BallByBallCollapsibleSection({
  timeline,
  variant = 'scorecard',
}: BallByBallCollapsibleSectionProps): React.ReactElement | null {
  const [expanded, setExpanded] = useState(false);
  const overs = useMemo(() => groupTimelineEntriesByOver(timeline), [timeline]);

  if (overs.length === 0) {
    return null;
  }

  const cardClass =
    variant === 'live'
      ? 'rounded-control border border-outline-variant bg-surface p-3'
      : 'rounded-control border border-outline-variant bg-surface-container-lowest p-4';
  const titleClass =
    variant === 'live' ? LIVE_SCORECARD_TYPE.sectionTitle : 'font-sans-bold text-base text-on-surface';

  return (
    <View className={`gap-3 ${cardClass}`} style={INPUT_SHADOW_STYLE}>
      <Pressable
        onPress={() => setExpanded((current) => !current)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={expanded ? 'Collapse Ball by Ball' : 'Expand Ball by Ball'}
        className="flex-row items-center justify-between gap-3 active:opacity-80"
      >
        <Text className={titleClass}>Ball by Ball</Text>
        <MaterialIcons
          name={expanded ? 'expand-less' : 'expand-more'}
          size={24}
          color={FIELD_ORANGE}
        />
      </Pressable>

      {expanded ? (
        <View className="gap-3">
          {overs.map((over) => (
            <View key={over.overNumber} className="gap-1.5">
              <Text className={LIVE_SCORECARD_TYPE.overHeader}>Over {over.overNumber}</Text>
              <View className="flex-row flex-wrap gap-1.5">
                {over.entries.map((entry) => (
                  <BallChip key={entry.sequence} entry={entry} />
                ))}
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
