import { useLocalSearchParams } from 'expo-router';

import { KnockoutChartScreen } from '../../../src/components/tournament/KnockoutChartScreen';

export default function KnockoutChartRoute(): React.ReactElement {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();

  return (
    <KnockoutChartScreen
      tournamentId={id ?? ''}
      tournamentName={typeof name === 'string' ? name : 'Tournament'}
    />
  );
}
