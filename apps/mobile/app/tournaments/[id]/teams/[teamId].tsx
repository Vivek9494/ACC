import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TeamDetailScreen } from '../../../../src/components/tournament/TeamDetailScreen';

export default function TeamDetailRoute(): React.ReactElement | null {
  const { id, teamId } = useLocalSearchParams<{ id: string; teamId: string }>();
  if (!id || !teamId) {
    return null;
  }
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      <TeamDetailScreen tournamentId={id} teamId={teamId} />
    </SafeAreaView>
  );
}
