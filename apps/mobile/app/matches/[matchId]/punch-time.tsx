import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PunchTimeScreen } from '../../../src/components/attendance/PunchTimeScreen';

export default function PunchTimeRoute(): React.ReactElement | null {
  const { matchId, teamId } = useLocalSearchParams<{ matchId: string; teamId: string }>();
  if (!matchId || !teamId) {
    return null;
  }
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      <PunchTimeScreen matchId={matchId} teamId={teamId} />
    </SafeAreaView>
  );
}
