import {
  normalizeMatchStateForBadge,
  resolveMatchStateBadge,
  type MatchState,
} from '@acc/types';
import { View } from 'react-native';
import { Text } from './ui/Text';

/** Tailwind classes per match state (spec §5.2 badge on the match card). */
const STATE_STYLES: Record<MatchState, string> = {
  SCHEDULED: 'bg-stone-200',
  PLAYING_XI_LOCKED: 'bg-secondary-100',
  TOSS_COMPLETED: 'bg-secondary-100',
  LIVE: 'bg-primary',
  DELAYED: 'bg-stone-200',
  RAIN_INTERRUPTED: 'bg-stone-200',
  CANCELLED: 'bg-stone-300',
  NO_RESULT: 'bg-stone-200',
  COMPLETED: 'bg-secondary-100',
  SCORECARD_LOCKED: 'bg-secondary-100',
};

const STATE_TEXT: Record<MatchState, string> = {
  SCHEDULED: 'text-stone-700',
  PLAYING_XI_LOCKED: 'text-secondary-700',
  TOSS_COMPLETED: 'text-secondary-700',
  LIVE: 'text-text-inverse',
  DELAYED: 'text-stone-700',
  RAIN_INTERRUPTED: 'text-stone-700',
  CANCELLED: 'text-secondary-800',
  NO_RESULT: 'text-stone-700',
  COMPLETED: 'text-secondary-700',
  SCORECARD_LOCKED: 'text-secondary-700',
};

export function MatchStateBadge({ state }: { state: MatchState }): React.ReactElement {
  const displayState = normalizeMatchStateForBadge(state);
  const { label } = resolveMatchStateBadge(state);

  return (
    <View className={`self-start rounded-full px-3 py-1 ${STATE_STYLES[displayState]}`}>
      <Text
        className={`font-sans-medium text-[11px] uppercase tracking-wider ${STATE_TEXT[displayState]}`}
      >
        {label}
      </Text>
    </View>
  );
}
