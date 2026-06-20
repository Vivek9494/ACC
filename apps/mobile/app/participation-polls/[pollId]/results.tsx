import { useLocalSearchParams } from 'expo-router';

import { PollResultsScreen } from '../../../src/components/dashboard/PollResultsScreen';

export default function PollResultsRoute(): React.ReactElement | null {
  const { pollId } = useLocalSearchParams<{ pollId: string }>();
  if (!pollId) {
    return null;
  }
  return <PollResultsScreen pollId={pollId} />;
}
