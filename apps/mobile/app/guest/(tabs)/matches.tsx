import { GuestTabShell } from '../../../src/components/dashboard/GuestTabShell';
import { MyMatchesScreen } from '../../../src/components/my-matches/MyMatchesScreen';

export default function GuestMatchesScreen(): React.ReactElement {
  return (
    <GuestTabShell activeKey="matches">
      <MyMatchesScreen />
    </GuestTabShell>
  );
}
