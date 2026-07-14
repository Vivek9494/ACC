import { useLocalSearchParams } from 'expo-router';

import { TournamentFormScreen } from '../../../../src/components/tournament/TournamentFormScreen';

export default function EditTournamentScreen(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <TournamentFormScreen mode="edit" tournamentId={id} />;
}
