import {
  MatchStateBadgeStyle,
  resolveMatchStateBadge,
  type MatchState,
} from '@acc/types';
import { View } from 'react-native';

import { StatusPill } from '../ui/StatusPill';
import { Text } from '../ui/Text';

/** Inactive/cancelled — taupe grey, distinct from primary orange statuses. */
const CANCELLED_BADGE = {
  container: 'bg-stone-300',
  text: 'text-stone-800',
} as const;

const BADGE_CLASS: Record<
  Exclude<MatchStateBadgeStyle, typeof MatchStateBadgeStyle.Live>,
  { container: string; text: string; uppercase: boolean }
> = {
  [MatchStateBadgeStyle.Muted]: {
    container: 'bg-surface-container-high',
    text: 'text-on-surface-variant',
    uppercase: false,
  },
  [MatchStateBadgeStyle.Completed]: {
    container: 'bg-secondary-100',
    text: 'text-secondary-700',
    uppercase: false,
  },
  [MatchStateBadgeStyle.Cancelled]: {
    ...CANCELLED_BADGE,
    uppercase: false,
  },
  [MatchStateBadgeStyle.Paused]: {
    container: 'bg-secondary-container',
    text: 'text-secondary',
    uppercase: false,
  },
  [MatchStateBadgeStyle.Delayed]: {
    container: 'bg-primary-container',
    text: 'text-on-primary-container',
    uppercase: false,
  },
  [MatchStateBadgeStyle.PreLive]: {
    container: 'bg-surface-container-high',
    text: 'text-on-surface-variant',
    uppercase: false,
  },
};

function CancelledStatusBadge({ label }: { label: string }): React.ReactElement {
  return (
    <View className={`self-start rounded-full px-3 py-1 ${CANCELLED_BADGE.container}`}>
      <Text className={`font-sans-semibold text-[10px] tracking-wider ${CANCELLED_BADGE.text}`}>
        {label}
      </Text>
    </View>
  );
}

export function MatchCardDisplayBadge({
  state,
  variant = 'default',
}: {
  state: MatchState | string;
  /** Tournament Matches tab — primary orange for every status except Cancelled. */
  variant?: 'default' | 'tournamentPrimary';
}): React.ReactElement {
  const { label, style } = resolveMatchStateBadge(state);

  if (style === MatchStateBadgeStyle.Cancelled) {
    return <CancelledStatusBadge label={label} />;
  }

  if (variant === 'tournamentPrimary') {
    return (
      <View className="self-start rounded-full bg-primary px-3 py-1">
        <Text className="font-sans-semibold text-[10px] tracking-wider text-text-inverse">
          {label}
        </Text>
      </View>
    );
  }

  if (style === MatchStateBadgeStyle.Live) {
    return <StatusPill variant="live" label={label} />;
  }

  const classes = BADGE_CLASS[style];

  return (
    <View className={`self-start rounded-full px-3 py-1 ${classes.container}`}>
      <Text
        className={`font-sans-semibold text-[10px] tracking-wider ${classes.text}${
          classes.uppercase ? ' uppercase' : ''
        }`}
      >
        {label}
      </Text>
    </View>
  );
}
