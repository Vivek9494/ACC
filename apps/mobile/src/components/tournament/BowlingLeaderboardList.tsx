import type { BowlingLeaderboardEntry } from '@acc/types';
import { View } from 'react-native';

import { BowlingLeaderboardCard } from './BowlingLeaderboardCard';

export interface BowlingLeaderboardListProps {
  entries: BowlingLeaderboardEntry[];
}

export function BowlingLeaderboardList({
  entries,
}: BowlingLeaderboardListProps): React.ReactElement {
  return (
    <View className="gap-4">
      {entries.map((entry) => (
        <BowlingLeaderboardCard key={entry.userId} entry={entry} />
      ))}
    </View>
  );
}
