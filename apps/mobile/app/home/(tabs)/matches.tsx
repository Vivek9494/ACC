import { PlayerTabShell } from '../../../src/components/dashboard/PlayerTabShell';
import { MyMatchesScreen } from '../../../src/components/my-matches/MyMatchesScreen';

export default function PlayerMatchesScreen(): React.ReactElement {
  return (
    <PlayerTabShell activeKey="matches">
      <MyMatchesScreen />
    </PlayerTabShell>
  );
}
