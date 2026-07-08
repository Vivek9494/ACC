import type { ScorerStartableMatch } from '@acc/types';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';

import { buildPlayerDashboardSections } from '../../../src/components/dashboard/buildPlayerDashboardSections';
import { MatchSetupDialog } from '../../../src/components/dashboard/MatchSetupDialog';
import { DashboardScaffold } from '../../../src/components/dashboard/DashboardScaffold';
import { usePlayerDashboard } from '../../../src/hooks/usePlayerDashboard';
import { useActiveBroadcast } from '../../../src/hooks/useActiveBroadcast';
import { useAttendanceMonitor } from '../../../src/hooks/useAttendanceMonitor';
import { prependBroadcastSection } from '../../../src/lib/dashboard-broadcast';
import { useAuth } from '../../../src/lib/auth-context';

export default function PlayerDashboardScreen(): React.ReactElement {
  const router = useRouter();
  const { user } = useAuth();
  const { dashboard, isLoading, error, retry } = usePlayerDashboard();
  const { broadcast } = useActiveBroadcast(!isLoading && !error);
  useAttendanceMonitor(true);
  const [setupMatch, setSetupMatch] = useState<ScorerStartableMatch | null>(null);

  const sections = useMemo(() => {
    const base =
      dashboard && user
        ? buildPlayerDashboardSections(
            dashboard,
            router,
            user,
            (match) => setSetupMatch(match),
            retry,
          )
        : [];
    return prependBroadcastSection(base, broadcast);
  }, [broadcast, dashboard, router, retry, user]);

  return (
    <>
      <DashboardScaffold
        headerFallbackName="Player"
        isLoading={isLoading}
        error={error}
        onRetry={retry}
        sections={sections}
      />
      <MatchSetupDialog
        visible={setupMatch !== null}
        match={setupMatch}
        onClose={() => setSetupMatch(null)}
      />
    </>
  );
}
