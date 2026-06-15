import type { BattingLeaderboardEntry } from '@acc/types';
import { View } from 'react-native';

import { BattingLeaderboardCard } from './BattingLeaderboardCard';

export interface BattingLeaderboardListProps {
  entries: BattingLeaderboardEntry[];
}

export function BattingLeaderboardList({
  entries,
}: BattingLeaderboardListProps): React.ReactElement {
  return (
    <View className="gap-4">
      {entries.map((entry) => (
        <BattingLeaderboardCard key={entry.userId} entry={entry} />
      ))}
    </View>
  );
}
