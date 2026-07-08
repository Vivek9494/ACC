import { GuestTabShell } from '../../../src/components/dashboard/GuestTabShell';
import { GuestTournamentsListScreen } from '../../../src/components/tournament/GuestTournamentsListScreen';

export default function GuestTournamentsTabScreen(): React.ReactElement {
  return (
    <GuestTabShell activeKey="tournaments">
      <GuestTournamentsListScreen />
    </GuestTabShell>
  );
}
