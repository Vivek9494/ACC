import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { FIELD_ORANGE } from '../ui/fieldStyles';
import { TabEmptyState } from '../ui/TabEmptyState';

/** Leaderboard tab empty state — no player stats yet (§15.5). */
export function TournamentLeaderboardEmptyState(): React.ReactElement {
  return (
    <TabEmptyState
      icon={
        <View className="h-32 w-32 items-center justify-center rounded-full bg-primary/10">
          <Ionicons name="trophy-outline" size={96} color={FIELD_ORANGE} style={{ opacity: 0.45 }} />
        </View>
      }
      message="No records found in Leaderboard"
    />
  );
}
