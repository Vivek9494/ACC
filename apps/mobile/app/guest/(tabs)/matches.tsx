import { GuestTabShell } from '../../../src/components/dashboard/GuestTabShell';
import { Text } from '../../../src/components/ui/Text';

export default function GuestMatchesScreen(): React.ReactElement {
  return (
    <GuestTabShell activeKey="matches">
      <Text className="px-4 pt-4 font-sans-bold text-xl text-on-surface">Matches</Text>
      <Text className="mt-2 px-4 font-sans text-sm text-on-surface-variant">Coming soon.</Text>
    </GuestTabShell>
  );
}
