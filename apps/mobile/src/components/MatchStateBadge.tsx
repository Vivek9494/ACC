import { MATCH_STATE_LABELS, type MatchState } from '@acc/types';
import { View } from 'react-native';
import { Text } from './ui/Text';

/** Tailwind classes per match state (spec §5.2 badge on the match card). */
const STATE_STYLES: Record<MatchState, string> = {
  SCHEDULED: 'bg-surface-container-high',
  PLAYING_XI_LOCKED: 'bg-tertiary-container',
  TOSS_COMPLETED: 'bg-tertiary-container',
  LIVE: 'bg-primary-container',
  DELAYED: 'bg-surface-container-high',
  RAIN_INTERRUPTED: 'bg-surface-container-high',
  CANCELLED: 'bg-error-container',
  NO_RESULT: 'bg-surface-container-high',
  COMPLETED: 'bg-secondary-container',
  SCORECARD_LOCKED: 'bg-secondary-container',
};

const STATE_TEXT: Record<MatchState, string> = {
  SCHEDULED: 'text-on-surface-variant',
  PLAYING_XI_LOCKED: 'text-on-tertiary-container',
  TOSS_COMPLETED: 'text-on-tertiary-container',
  LIVE: 'text-on-primary',
  DELAYED: 'text-on-surface-variant',
  RAIN_INTERRUPTED: 'text-on-surface-variant',
  CANCELLED: 'text-on-error-container',
  NO_RESULT: 'text-on-surface-variant',
  COMPLETED: 'text-on-secondary-container',
  SCORECARD_LOCKED: 'text-on-secondary-container',
};

export function MatchStateBadge({ state }: { state: MatchState }): React.ReactElement {
  return (
    <View className={`self-start rounded-full px-3 py-1 ${STATE_STYLES[state]}`}>
      <Text className={`font-sans-medium text-[11px] uppercase tracking-wider ${STATE_TEXT[state]}`}>
        {MATCH_STATE_LABELS[state]}
      </Text>
    </View>
  );
}
