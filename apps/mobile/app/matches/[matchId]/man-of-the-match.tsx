import { useLocalSearchParams } from 'expo-router';

import { SelectManOfMatchScreen } from '../../../src/components/match/SelectManOfMatchScreen';

export default function ManOfMatchScreen(): React.ReactElement {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  return <SelectManOfMatchScreen matchId={matchId ?? ''} />;
}
