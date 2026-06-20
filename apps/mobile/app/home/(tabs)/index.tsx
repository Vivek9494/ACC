import type { ScorerStartableMatch } from '@acc/types';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';

import { buildPlayerDashboardSections } from '../../../src/components/dashboard/buildPlayerDashboardSections';
import { MatchSetupDialog } from '../../../src/components/dashboard/MatchSetupDialog';
import { DashboardScaffold } from '../../../src/components/dashboard/DashboardScaffold';
import { usePlayerDashboard } from '../../../src/hooks/usePlayerDashboard';
import { useAttendanceMonitor } from '../../../src/hooks/useAttendanceMonitor';
import { usePlayerTabConfig } from '../../../src/lib/player-tabs';

export default function PlayerDashboardScreen(): React.ReactElement {
  const router = useRouter();
  const { dashboard, isLoading, error, retry } = usePlayerDashboard();
  useAttendanceMonitor(true);
  const tabConfig = usePlayerTabConfig('index');
  const [setupMatch, setSetupMatch] = useState<ScorerStartableMatch | null>(null);

  const sections = useMemo(
    () =>
      dashboard
        ? buildPlayerDashboardSections(
            dashboard,
            router,
            (match) => setSetupMatch(match),
            retry,
          )
        : [],
    [dashboard, router, retry],
  );

  return (
    <>
      <DashboardScaffold
        headerFallbackName="Player"
        isLoading={isLoading}
        error={error}
        onRetry={retry}
        sections={sections}
        tabConfig={tabConfig}
      />
      <MatchSetupDialog
        visible={setupMatch !== null}
        match={setupMatch}
        onClose={() => setSetupMatch(null)}
      />
    </>
  );
}
