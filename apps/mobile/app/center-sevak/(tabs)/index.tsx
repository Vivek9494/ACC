import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import { buildCenterSevakDashboardSections } from '../../../src/components/dashboard/buildCenterSevakDashboardSections';
import { DashboardScaffold } from '../../../src/components/dashboard/DashboardScaffold';
import { useCenterSevakDashboard } from '../../../src/hooks/useCenterSevakDashboard';
import { useCenterSevakTabConfig } from '../../../src/lib/center-sevak-tabs';

export default function CenterSevakDashboardScreen(): React.ReactElement {
  const router = useRouter();
  const { dashboard, isLoading, error, retry } = useCenterSevakDashboard();
  const tabConfig = useCenterSevakTabConfig('index');

  const sections = useMemo(
    () =>
      dashboard ? buildCenterSevakDashboardSections(dashboard, router, retry) : [],
    [dashboard, router, retry],
  );

  return (
    <DashboardScaffold
      headerFallbackName="Sevak"
      isLoading={isLoading}
      error={error}
      onRetry={retry}
      sections={sections}
      tabConfig={tabConfig}
    />
  );
}
