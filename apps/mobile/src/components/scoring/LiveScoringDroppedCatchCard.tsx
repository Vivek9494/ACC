import {
  type DroppedCatchEventView,
  formatDroppedCatchEventDetail,
} from '@acc/types';
import { View } from 'react-native';

import { Text } from '../ui/Text';
import { INPUT_SHADOW_STYLE } from '../ui/fieldStyles';
import {
  SCORECARD_WICKET_EVENT_CARD,
  SCORECARD_WICKET_EVENT_DETAIL,
  SCORECARD_WICKET_EVENT_EMPHASIS,
} from './liveScoringScorecardTypography';

export interface LiveScoringDroppedCatchCardProps {
  events: DroppedCatchEventView[];
  nameOf: (id: string | null | undefined) => string;
}

/** Leader-only dropped-catch log — one innings, two-line rows per drop. */
export function LiveScoringDroppedCatchCard({
  events,
  nameOf,
}: LiveScoringDroppedCatchCardProps): React.ReactElement {
  return (
    <View
      className="gap-2 rounded-control border border-outline-variant bg-surface px-3 py-2"
      style={INPUT_SHADOW_STYLE}
    >
      <Text className="font-sans-semibold text-sm uppercase tracking-wide text-on-surface-variant">
        Catch Dropped ({events.length})
      </Text>

      <View className="gap-2">
        {events.map((event) => {
          const over = event.overBallLabel || '—';
          const batsmanName = nameOf(event.batsmanId);

          return (
            <View key={event.sequence} className={SCORECARD_WICKET_EVENT_CARD}>
              <Text className={SCORECARD_WICKET_EVENT_DETAIL}>
                <Text className={SCORECARD_WICKET_EVENT_EMPHASIS}>{batsmanName}</Text>
                {` - ${event.batsmanRuns} (${event.batsmanBalls})  |  Over ${over}`}
              </Text>
              <Text className={SCORECARD_WICKET_EVENT_DETAIL}>
                {formatDroppedCatchEventDetail(event, nameOf)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
