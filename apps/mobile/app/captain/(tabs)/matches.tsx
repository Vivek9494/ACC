import { CaptainTabShell } from '../../../src/components/dashboard/CaptainTabShell';
import { MyMatchesScreen } from '../../../src/components/my-matches/MyMatchesScreen';

export default function CaptainMatchesScreen(): React.ReactElement {
  return (
    <CaptainTabShell activeKey="matches">
      <MyMatchesScreen />
    </CaptainTabShell>
  );
}
