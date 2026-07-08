import { useLocalSearchParams } from 'expo-router';

import { KnockoutBracketManageScreen } from '../../../src/components/tournament/KnockoutBracketManageScreen';

export default function KnockoutBracketRoute(): React.ReactElement {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();

  return (
    <KnockoutBracketManageScreen
      tournamentId={id ?? ''}
      tournamentName={typeof name === 'string' ? name : 'Tournament'}
    />
  );
}
