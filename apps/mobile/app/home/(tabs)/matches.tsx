import { PlayerTabShell } from '../../../src/components/dashboard/PlayerTabShell';
import { Text } from '../../../src/components/ui/Text';

export default function PlayerMatchesScreen(): React.ReactElement {
  return (
    <PlayerTabShell activeKey="matches">
      <Text className="px-4 pt-4 font-sans-bold text-xl text-on-surface">Matches</Text>
      <Text className="mt-2 px-4 font-sans text-sm text-on-surface-variant">Coming soon.</Text>
    </PlayerTabShell>
  );
}
