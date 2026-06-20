import { useLocalSearchParams } from 'expo-router';

import { SelectBowlerScreen } from '../../../src/components/scoring/SelectBowlerScreen';

export default function SelectBowlerRoute(): React.ReactElement {
  const { matchId, inningsId, selectedBowlerId } = useLocalSearchParams<{
    matchId: string;
    inningsId: string;
    selectedBowlerId?: string;
  }>();

  return (
    <SelectBowlerScreen
      matchId={matchId}
      inningsId={inningsId}
      selectedBowlerId={selectedBowlerId ?? null}
    />
  );
}
