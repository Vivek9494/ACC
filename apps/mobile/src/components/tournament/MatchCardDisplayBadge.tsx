import { MatchCardDisplayState } from '@acc/types';
import { View } from 'react-native';

import { StatusPill } from '../ui/StatusPill';
import { Text } from '../ui/Text';

const BADGE_LABEL: Record<MatchCardDisplayState, string> = {
  [MatchCardDisplayState.Completed]: 'RESULT',
  [MatchCardDisplayState.Live]: 'LIVE',
  [MatchCardDisplayState.Scheduled]: 'SCHEDULED',
};

const BADGE_CLASS: Record<MatchCardDisplayState, string> = {
  [MatchCardDisplayState.Completed]: 'bg-surface-container-high',
  [MatchCardDisplayState.Live]: 'bg-error',
  [MatchCardDisplayState.Scheduled]: 'bg-surface-container-high',
};

const BADGE_TEXT_CLASS: Record<MatchCardDisplayState, string> = {
  [MatchCardDisplayState.Completed]: 'text-on-surface-variant',
  [MatchCardDisplayState.Live]: 'text-on-error',
  [MatchCardDisplayState.Scheduled]: 'text-on-surface-variant',
};

export function MatchCardDisplayBadge({
  displayState,
}: {
  displayState: MatchCardDisplayState;
}): React.ReactElement {
  if (displayState === MatchCardDisplayState.Live) {
    return <StatusPill variant="live" label={BADGE_LABEL[displayState]} />;
  }

  return (
    <View className={`self-start rounded-full px-3 py-1 ${BADGE_CLASS[displayState]}`}>
      <Text
        className={`font-sans-semibold text-[10px] uppercase tracking-wider ${BADGE_TEXT_CLASS[displayState]}`}
      >
        {BADGE_LABEL[displayState]}
      </Text>
    </View>
  );
}
