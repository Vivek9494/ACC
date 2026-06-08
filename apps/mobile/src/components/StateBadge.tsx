import { TOURNAMENT_STATE_LABELS, type TournamentState } from '@acc/types';
import { View } from 'react-native';
import { Text } from './ui/Text';

/** Tailwind classes per lifecycle state (spec §5.1 badge on the Tournament Card). */
const STATE_STYLES: Record<TournamentState, string> = {
  NEW: 'bg-surface-container-high',
  REGISTRATION_OPEN: 'bg-secondary-container',
  REGISTRATION_CLOSED: 'bg-surface-container-high',
  TEAMS_FINALIZED: 'bg-tertiary-container',
  FIXTURE_PUBLISHED: 'bg-tertiary-container',
  LIVE: 'bg-primary-container',
  KNOCKOUT: 'bg-primary-container',
  COMPLETED: 'bg-surface-container-high',
};

const STATE_TEXT: Record<TournamentState, string> = {
  NEW: 'text-on-surface-variant',
  REGISTRATION_OPEN: 'text-on-secondary-container',
  REGISTRATION_CLOSED: 'text-on-surface-variant',
  TEAMS_FINALIZED: 'text-on-tertiary-container',
  FIXTURE_PUBLISHED: 'text-on-tertiary-container',
  LIVE: 'text-on-primary',
  KNOCKOUT: 'text-on-primary',
  COMPLETED: 'text-on-surface-variant',
};

export function StateBadge({ state }: { state: TournamentState }): React.ReactElement {
  return (
    <View className={`self-start rounded-full px-3 py-1 ${STATE_STYLES[state]}`}>
      <Text className={`font-sans-medium text-[11px] uppercase tracking-wider ${STATE_TEXT[state]}`}>
        {TOURNAMENT_STATE_LABELS[state]}
      </Text>
    </View>
  );
}
