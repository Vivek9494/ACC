import { HOME_AWAY_LABELS, type HomeAway } from '@acc/types';
import { View } from 'react-native';

import { Text } from '../ui/Text';

export interface MatchHomeAwayBadgeProps {
  homeAway: HomeAway;
}

/** Ground-setup pill — same capsule shape as match-date chip, filled secondary. */
export function MatchHomeAwayBadge({ homeAway }: MatchHomeAwayBadgeProps): React.ReactElement {
  return (
    <View className="self-start rounded-full bg-secondary px-2.5 py-0.5">
      <Text className="font-sans-semibold text-sm text-text-inverse">
        {HOME_AWAY_LABELS[homeAway]}
      </Text>
    </View>
  );
}

export function MatchHomeAwayBadgeOrNull({
  homeAway,
}: {
  homeAway?: HomeAway | null;
}): React.ReactElement | null {
  if (!homeAway) {
    return null;
  }
  return <MatchHomeAwayBadge homeAway={homeAway} />;
}
