import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlayingXiSelectionScreen } from '../../../src/components/dashboard/PlayingXiSelectionScreen';

export default function PlayingXiSelectionRoute(): React.ReactElement | null {
  const { pollId } = useLocalSearchParams<{ pollId: string }>();
  if (!pollId) {
    return null;
  }
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      <PlayingXiSelectionScreen pollId={pollId} />
    </SafeAreaView>
  );
}
