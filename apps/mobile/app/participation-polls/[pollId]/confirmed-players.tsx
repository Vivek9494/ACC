import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConfirmedPlayersScreen } from '../../../src/components/dashboard/ConfirmedPlayersScreen';

export default function ConfirmedPlayersRoute(): React.ReactElement | null {
  const { pollId } = useLocalSearchParams<{ pollId: string }>();
  if (!pollId) {
    return null;
  }
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      <ConfirmedPlayersScreen pollId={pollId} />
    </SafeAreaView>
  );
}
