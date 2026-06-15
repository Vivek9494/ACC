import { useLocalSearchParams } from 'expo-router';

import { AccFeesTrackerScreen } from '../../../src/components/tournament/fees/AccFeesTrackerScreen';

export default function TournamentFeesTrackerRoute(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AccFeesTrackerScreen tournamentId={id ?? ''} />;
}
