import { CenterSevakTabShell } from '../../../src/components/dashboard/CenterSevakTabShell';
import { MyMatchesScreen } from '../../../src/components/my-matches/MyMatchesScreen';

export default function CenterSevakMatchesScreen(): React.ReactElement {
  return (
    <CenterSevakTabShell activeKey="matches">
      <MyMatchesScreen />
    </CenterSevakTabShell>
  );
}
