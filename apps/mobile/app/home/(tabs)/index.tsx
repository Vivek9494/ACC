import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import { buildPlayerDashboardSections } from '../../../src/components/dashboard/buildPlayerDashboardSections';
import { DashboardScaffold } from '../../../src/components/dashboard/DashboardScaffold';
import { usePlayerDashboard } from '../../../src/hooks/usePlayerDashboard';
import { usePlayerTabConfig } from '../../../src/lib/player-tabs';

export default function PlayerDashboardScreen(): React.ReactElement {
  const router = useRouter();
  const { dashboard, isLoading, error, retry } = usePlayerDashboard();
  const tabConfig = usePlayerTabConfig('index');

  const sections = useMemo(
    () => (dashboard ? buildPlayerDashboardSections(dashboard, router) : []),
    [dashboard, router],
  );

  return (
    <DashboardScaffold
      headerFallbackName="Player"
      isLoading={isLoading}
      error={error}
      onRetry={retry}
      sections={sections}
      tabConfig={tabConfig}
    />
  );
}
